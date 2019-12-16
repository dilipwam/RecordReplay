/*

USER EVENTS

For User Events, we need to do several things, logging with error messages as well

1: MatchingUrlReport: check that the event was generated by this page, checking for origin and path, then also check for search params 'almost-equality', fail if unmatched
2: ReplaySelectorReport: Check that the target element is on page, match HTMLElement and tag, fail if none, assess the performance of the selectors, save xpath of the element for matching with playback
3: TypeReplayer: Simulate the event on the element, we know the element is on the page. Artificial or input / text select return value of true. Generate observable listener targeted at specific selector.
4: Messaging Observable: Listen to simulated event being played back, with matching xpath as css class selectors can change, fail if none, final confirmation that the replay has worked as intended

USER ASSERTIONS

1: MatchingUrlReport: check that the event was generated by this page, checking for origin and path, then also check for search params 'almost-equality', fail if unmatched
2: ReplaySelectorReport: Check that the target element is on page, match HTMLElement and tag, fail if none, assess the performance of the selectors, save xpath of the element for matching with playback
3: TypeReplayer: Return value important: true for assertion passes. Simulate an artificial 'mouseenter' event on the element, generate an observable 'mouseenter' listener targeted at specific selector.
4: Messaging Observable: Check return value. Listen to simulated event being played back, with matching xpath as css class selectors can change, fail if none, final confirmation that the replay has worked as intended

*/

var EventReplayer = {
    messengerService: new RecordReplayMessenger({}).isAsync(true),
    logWithContext: message => {
        if (EventReplayer.contextIsIframe()) {
            console.log(`%cEvent Replayer: ${window.location.origin}: ${message}`, 'color: green');
        } else {
            console.log(`%cEvent Replayer: ${window.location.origin}: ${message}`, 'color: blue');
        }
    },
    mapEventToReplayer: replayEvent => {
        switch(replayEvent.recordingEventAction) {
            case 'TextSelect': return new TextSelectReplay(replayEvent)
            case 'Mouse': return new MouseReplay(replayEvent)
            case 'Input': return new InputReplay(replayEvent)
            case 'Scroll': return new ScrollReplay(replayEvent)
            case 'Assertion': return new AssertionReplay(replayEvent)
        }
    },
    //we need to know if we are in an iframe - has implications right through the application
    contextIsIframe: () => { 
        try { return window.self !== window.top; } 
        catch (e) { return true; } 
    },
    //we should always be in the context of a content script
    contextIsContentScript: () => { return typeof chrome.runtime.getManifest != 'undefined' },
    //we need to have the xpath function to check the equivalence of the event listener target and the original event execution target
    getXPath: element => {
        //get all the nodes in the document by tagname wildcard
        var allNodes = document.getElementsByTagName('*');
        //create the array to hold the different bits of the xpath, execute the code block if we have an element and the element is an element node, 
        //then jump up to parent when finished with each node   
        for (var segs = []; element && element.nodeType == 1; element = element.parentNode) {
            //check to see if the element has an id because this is then going to be fast
            if (element.hasAttribute('id')) {
                //set the marker for whether the id is unique in the page
                var uniqueIdCount = 0;
                //search through all the nodes 
                for (var n=0; n < allNodes.length; n++) {
                    //if we have a duplicate id, this is not going to work so bump the marker
                    if (allNodes[n].hasAttribute('id') && allNodes[n].id == element.id) uniqueIdCount++;
                    //then if we do not have a unique id we break out of the loop
                    if (uniqueIdCount > 1) break;
                }
                //the marker holds the value
                if (uniqueIdCount == 1) {
                    //if we only have one element with that id we can create the xpath now so we push the start path and then id into the array at the beginning
                    segs.unshift("//*[@id='" + element.getAttribute('id') + "']");
                    //then we're done and we send it back to the caller
                    return segs.join('/');
                } else {
                    //otherwise we save the tagname and the id and continue on as we are going to need more qualifiers for a unqiue xpath
                    segs.unshift(element.localName.toLowerCase() + '[@id="' + element.getAttribute('id') + '"]');
                }
            } else {
                //with no id, we need to do something different
                //we need to identify its place amongst siblings - is it the first list item or the third
                for (var i = 1, sib = element.previousSibling; sib; sib = sib.previousSibling) {
                    //this counts back until we have no previous sibling
                    if (sib.localName == element.localName)  i++; 
                }
                //just push the local name into the array along with the position
                segs.unshift(element.localName.toLowerCase() + '[' + i + ']');
            }
         }
         //then once we've worked our way up to an element with id or we are at the element with no parentNode - the html - we return all the strings joined with a backslash
         return segs.length ? '/' + segs.join('/') : null;
     }
}

EventReplayer.startReplayingEvents = () => {
    
    EventReplayer.messengerService.chromeOnMessageObservable
        //firstly we only care about messages that contain a replay event
        .filter(messageObject => messageObject.request.hasOwnProperty('replayEvent')) 
        //the messages that need to go to all content script are all the user events and the assertions, marked as replay events
        .filter(messageObject => messageObject.request.replayEvent.recordingEventOrigin == 'User' || messageObject.request.replayEvent.recordingEventOrigin == 'Replay')
        //but we don't want to send the keyboard events, as they are handled in background script
        .filter(messageObject => messageObject.request.replayEvent.recordingEventAction != 'Keyboard')
        //if we have a replay event, then map the message object to the replay event only and attach the sendResponse so we can return feedback as soon as we get it
        .map(messageObject => {
            //we need to extract the replay event coming in from the message object
            let replayEvent = messageObject.request.replayEvent;
            //we need to attach the sendResponse callback to the replay event
            replayEvent.sendResponse = messageObject.sendResponse;
            //then return the replay event
            return replayEvent;
        })
        //then we start operating our replay logic - we start by mapping the event to our individual event type handlers
        .map(replayEvent => EventReplayer.mapEventToReplayer(replayEvent) )
        //then we can filter all those event handlers that return with a state of false
        .filter(typeReplayer => typeReplayer.replayEventStatus != false)
        //then we have to add the listener for playback confirmation and subsequently execute the function
        .flatMap(typeReplayer =>
            //we have to have a check for failure at this stage as well, we do this with a merge and a timer
            Rx.Observable.merge(
                //we always need to have matching events - the event execution and the playback
                Rx.Observable.zip( typeReplayer.returnPlayBackObservable(), Rx.Observable.from(typeReplayer.actionFunction()) ),
                //then we need to assume that the playback listener and the action function happen in quite quickly, 
                //however, we need some leeway for the scrolling otherwise the timer can emit before the scroll has finished and the playback event has fired
                Rx.Observable.timer(typeReplayer.action == "Scroll" ? 5000 : 100).map(timer => ["Execution Playback Timeout", timer])
            //then we take either the first emission from the action / playback observable or the timer 
            ).take(1), 
            //we need the original event replayer and the array that is returned by the zip function
            (typeReplayer, [event, actionFunctionResult]) => {
                //then at this point we need to do multiple checks, starting with the check that the function has executed within the time frame
                if (event == "Execution Playback Timeout") {
                    // we report the time of the fail
                    typeReplayer.replayEventReplayed = Date.now();
                    //and we set the status to false to indicate a failed replay
                    typeReplayer.replayEventStatus = false;
                    //and we need to provide information on why the replay failed
                    typeReplayer.replayErrorMessages.push(`${typeReplayer.actionType.toUpperCase()} ${event}`)
                    //then send the response if we have the facility
                    if (typeReplayer.sendResponse != null) {
                        //first we make a clone of this 
                        var replayExecution = Object.assign({}, typeReplayer);
                        //then we delete the sendResponse function from the clone, just to avoid any confusion as it passes through messaging system
                        delete replayExecution.sendResponse;
                        //then we send the clean clone
                        typeReplayer.sendResponse({replayExecution: replayExecution});
                    }   
                    //and then we should return the typeReplayer - it will be filtered out
                    return typeReplayer;
                }
                //to check the event target we need to do things slightly differently for scrolling events that happen on the whole document
                let eventTarget = (event.target instanceof HTMLDocument ? event.target.scrollingElement : event.target);
                //then we get the xpath
                const eventTargetXpath = EventReplayer.getXPath(eventTarget);
                //then we need to check the equivalence of the xpath
                if (typeReplayer.chosenSelectorReport.xpath !== eventTargetXpath) {

                    // we report the time of the fail
                    typeReplayer.replayEventReplayed = Date.now();
                    //and we set the status to false to indicate a failed replay
                    typeReplayer.replayEventStatus = false;
                    //and we need to provide information on why the replay failed
                    typeReplayer.replayErrorMessages.push(`${typeReplayer.actionType.toUpperCase()} Execution Playback Misalignment`)
                    //then send the response if we have the facility
                    if (typeReplayer.sendResponse != null) {
                        //first we make a clone of this 
                        var replayExecution = Object.assign({}, typeReplayer);
                        //then we delete the sendResponse function from the clone, just to avoid any confusion as it passes through messaging system
                        delete replayExecution.sendResponse;
                        //then we send the clean clone
                        typeReplayer.sendResponse({replayExecution: replayExecution});
                    }   
                    //and then we should return the typeReplayer - it will be filtered out
                    return typeReplayer;
                }
                //then we need to check if our assertion actionFunctionResult has failed
                if (actionFunctionResult == false) {
                    // we report the time of the fail
                    typeReplayer.replayEventReplayed = Date.now();
                    //and we set the status to false to indicate a failed replay
                    typeReplayer.replayEventStatus = false;
                    //and we need to provide information on why the replay failed
                    typeReplayer.replayErrorMessages.push(`${typeReplayer.actionType.toUpperCase()} Assertion Failed`)
                    //then send the response if we have the facility
                    if (typeReplayer.sendResponse != null) {
                        //first we make a clone of this 
                        var replayExecution = Object.assign({}, typeReplayer);
                        //then we delete the sendResponse function from the clone, just to avoid any confusion as it passes through messaging system
                        delete replayExecution.sendResponse;
                        //then we send the clean clone
                        typeReplayer.sendResponse({replayExecution: replayExecution});
                    }   
                    //and then we should return the typeReplayer - it will be filtered out
                    return typeReplayer;
                } else {
                    //we need to confirm we have matching text content, attributes, etc
                    typeReplayer.replayLogMessages.push(`${typeReplayer.actionType.toUpperCase()} Assertion Passed`);
                }
                //otherwise we have a successful event replay and we need to update the event player to indicate that
                // we report the time of the pass
                typeReplayer.replayEventReplayed = Date.now();
                //and we set the status to true to indicate a successful replay
                typeReplayer.replayEventStatus = true;
                //then report to the log messages array
                typeReplayer.replayLogMessages.push(`${typeReplayer.actionType.toUpperCase()} Event Playback Confirmed`);
                //then return so we can send the message back to the user interface
                return typeReplayer;
            }
        )
        //we will only have successful events passing this final filter
        .filter(typeReplayer => typeReplayer.replayEventStatus)
        //so we can now action our successful events
        .subscribe(
            typeReplayer => {
                console.log(typeReplayer);
                //then send the response if we have the facility
                if (typeReplayer.sendResponse != null) {
                    //first we make a clone of this 
                    var replayExecution = Object.assign({}, typeReplayer);
                    //then we delete the sendResponse function from the clone, just to avoid any confusion as it passes through messaging system
                    delete replayExecution.sendResponse;
                    //then we send the clean clone
                    typeReplayer.sendResponse({replayExecution: replayExecution});
                }   
            },
            error => EventReplayer.logWithContext(error),
            () => EventReplayer.logWithContext("EventReplayer.startReplayingEvents: COMPLETE")
        );

}

//START FUNCTION
//WE ONLY WANT TO START IN IFRAME OR CONTENT SCRIPT CONTEXT
//IF THIS IS INJECTED INTO MAIN FRAME BY DEBUGGER, WE WILL HAVE DOUBLE REPORTING
switch(true) {
    //if we are an iframe we need to report and start
    case EventReplayer.contextIsIframe():
        console.log(`%cEvent Replayer activated via Content Script in iframe with origin ${window.location.origin}`, 'color: green');
        EventReplayer.startReplayingEvents();
        break;
    case EventReplayer.contextIsContentScript():
        console.log(`%cEvent Replayer activated via Content Script in main frame with origin ${window.location.origin}`, 'color: blue');
        EventReplayer.startReplayingEvents();
        break;
    default:
        console.log(`%cEvent Replayer NOT activated in main frame with origin ${window.location.origin}`, 'color: dimgrey');
}