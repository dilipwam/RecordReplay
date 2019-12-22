class InputReplay {

    constructor(replayEvent) {

        //so there are generic properties that need to be imported into all specific replay classes from the replay event
        //we need to have the replay id so the content scripts and user interface can be sure they are communicating about the same event
        this.replayId = replayEvent.replayEventId;
        //the replay event action is required for reporting to the console
        this.action = replayEvent.recordingEventAction;
        //the action type is saved as different action types can require different handling in the action and playback functions
        this.actionType = replayEvent.recordingEventActionType;
        //the HTML element constructor name is used to double check the good operation of the css selectors
        this.targetHTMLName = replayEvent.recordingEventHTMLElement;
        //same with the tag name, just a method of ensuring that the selector has not identified the wrong element
        this.targetTagName = replayEvent.recordingEventHTMLTag;
        //we need to save all three selector paths, it's possible that a class-based selector can fail while the others succeeed
        this.cssSelectorPath = replayEvent.recordingEventCssSelectorPath;
        this.domPath = replayEvent.recordingEventCssDomPath;
        this.finderPath = replayEvent.recordingEventCssFinderPath;
        //then we need to save xpath
        this.xpath = replayEvent.recordingEventXPath;
        //then we need to keep the messaging send response function attached to the class as the testing process relies on sending responses back to user interface
        this.sendResponse = replayEvent.sendResponse || null;

        //then special properties for input replays
        this.inputType = replayEvent.recordingEventInputType;
        this.inputValue = replayEvent.recordingEventInputValue;
        
        //then there are generic state properties that we need for reporting back to the user interface
        //log messages are displayed to the user in the case of success or failure
        this.replayLogMessages = [];
        //error messages are only displayed on failure
        this.replayErrorMessages = [];
        //always important to assess whether the record/replay is operating in the context of an iframe
        this.isIframe = EventReplayer.contextIsIframe();
        //once the selectors have been tested and assessed, one selector report is chosen
        this.chosenSelectorReport = null;
        //we need to know when the event was replayed as the user interface shows timings
        this.replayEventReplayed = 0;

        //KEY MARKER - SUCCESS OR FAILURE OF REPLAY
        this.replayEventStatus = null;

        //first we check in each class that we have a matching url
        this.matchingUrlReport = new MatchingUrlReport(replayEvent);

        //then we only need to do any further work if we have a matching url report
        //if the url report is not matching, everything else is a waste of time
        //we especially don't need any messages sent back from unmatched urls, reporting that we can't find a selector
        if (this.matchingUrlReport.matched) {

            //then each replay class must have a collected set of Replay Selector Reports
            this.replaySelectorReports = [
                new ReplaySelectorReport({ key: "CssSelector", selectorString: this.cssSelectorPath, targetHtmlName: this.targetHTMLName, targetHtmlTag: this.targetTagName }),
                new ReplaySelectorReport({ key: "DomPathSelector", selectorString: this.domPath, targetHtmlName: this.targetHTMLName, targetHtmlTag: this.targetTagName }),
                new ReplaySelectorReport({ key: "FinderSelector", selectorString: this.finderPath, targetHtmlName: this.targetHTMLName, targetHtmlTag: this.targetTagName }),
                //here we need to send slightly different input into the class, which must then generate its own CSS selector string
                new ReplayXpathReport({ key: "XPathSelector", xpathString: this.xpath, targetHtmlName: this.targetHTMLName, targetHtmlTag: this.targetTagName })
            ];

            //see if we have any invalid selector reports
            this.failedReplaySelectorReports = this.replaySelectorReports.filter(report => report.invalidSelector);
            //if we have invalid selectors then we need to know
            if (this.failedReplaySelectorReports.length > 0) this.replayErrorMessages.push(this.failedReplaySelectorReports.map(report => report.warningMessages).join(', '));
            //see if we have any valid selector reports, and if we do, we save as the definitive selector reports 
            this.replaySelectorReports = this.replaySelectorReports.filter(report => !report.invalidSelector);
            //if we have valid selectors then we need to know about which ones remain valid
            if (this.replaySelectorReports.length > 0) this.replayLogMessages.push(this.replaySelectorReports.map(report => report.logMessages).join(', '));

            //then we need to have an outcome
            if (this.replaySelectorReports.length > 0) {
                //select the first report that has provided a positive response and has the shortest selector
                this.chosenSelectorReport = this.replaySelectorReports.sort((reportA, reportB) => reportA.selectorString.length - reportB.selectorString.length)[0];
            } else {
                //then we need to push an error message to the logs
                this.replayErrorMessages.push(`No Valid Target On Page`);
                //otherwise we report the time of the fail
                this.replayEventReplayed = Date.now();
                //and we set the status to false to indicate a failed replay
                this.replayEventStatus = false;
                //then send the response if we have the facility
                if (this.sendResponse != null) {
                    //first we make a clone of this 
                    var replayExecution = Object.assign({}, this);
                    //then we delete the sendResponse function from the clone, just to avoid any confusion as it passes through messaging system
                    delete replayExecution.sendResponse;
                    //then we send the clean clone
                    this.sendResponse({replayExecution: replayExecution});
                }            
            }

        //if we have a non-matching url report, just set the event status to false so no further processing is done
        } else { this.replayEventStatus = false; }

    }

     //all of the replayers must have an action function that will instantiate the replay - make it happen on the page
     actionFunction = () => {
        //here we need a very slight delay to ensure that our listener is in place before the action function executes
        return new Promise(resolve => {
            //we use setTimeout and resolve to introduce the delay
            setTimeout( () => {
                
                //we have to be sensitive here to whether the input element is input, textarea or contenteditable as we change them in different ways
                const targetElement = document.querySelector(this.chosenSelectorReport.selectorString);
                //we fire the same event for any type - the artificial event so our playback can confirm
                const inputEvent = new Event("change", {view: window, bubbles: true, cancelable: false}); 
                //if we are talking about an input element or a text area element, then we know what we are doing
                if (targetElement instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
                    //set the value of the input element to be our saved value
                    targetElement.value = this.inputValue;
                    //then report to the log messages array
                    this.replayLogMessages.push(`${this.actionType.toUpperCase()} Value Executed`);
                    //then return the current input value is the same as our saved input value
                    resolve(targetElement.value == this.inputValue);
                }
                //if we are talking about a contentEditable element, then we do not use value but text content
                if (targetElement.isContentEditable) {
                    //set the value of the input element to be our saved value
                    targetElement.textContent = this.inputValue;
                    //then report to the log messages array
                    this.replayLogMessages.push(`${this.actionType.toUpperCase()} Value Executed`);
                    //then return the current input value is the same as our saved input value
                    resolve(targetElement.textContent == this.inputValue);
                }
                //then dispatching the same event for both
                targetElement.dispatchEvent( inputEvent );

            }, 5);
        });

    }
    
    returnPlayBackObservable = () => Rx.Observable.fromEvent(document.querySelector(this.chosenSelectorReport.selectorString), "change")

}