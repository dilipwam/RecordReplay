class PuppeteerTranslator {

    //pass in an options object which can take new languages
    constructor(options) {
        
        // set default values for the keycodes class 
        const defaults = {

            //internal defaults
            recordingTestUrl: "",
            recordingTestID: 0,
            //need a keycode dictionary 
            keyCodeDictionary: new KeyCodeDictionary,
            //messaging for code
            standardOpeningComment: "\n\t/*\n" 
            + "\t\t Your options for launching Puppeteer will depend upon your system setup and preferences. \n"
            + "\t\t The following code depends upon you having successfully launched Puppeteer with the reference 'browser'.\n"
            + "\t\t Don't forget to call 'browser.close()' at the end of your tests.\n"
            + "\t*/\n",
            standardRecordingComment: "/*\n" 
            + "\t This is Puppeteer code generated by Record/Replay from a RECORDING. \n"
            + "\t As such it only contains ACTIONS, not ASSERTIONS.\n"
            + "\t If you want to have code with assertions included, you need to generate a replay of this recording and download the replay code.\n"
            + "*/\n\n",
            //puppeteer defaults
            defaultNetworkOffline: false,
            defaultNetworkDownload: -1,
            defaultNetworkUpload: -1,
            defaultLatency: 0

        }
        // create a new object with the defaults over-ridden by the options passed in
        let opts = Object.assign({}, defaults, options);
  
        // assign options to instance data (using only property names contained in defaults object to avoid copying properties we don't want)
        Object.keys(defaults).forEach(prop => { this[prop] = opts[prop]; });
    }

    //FORMATTING FUNCTIONS

    openAnonAsyncFunction = () => `(async () => { \n`

    closeAnonAsyncFunction = () => `\n})();`

    openTimedFunction = () => `\n\tawait new Promise(resolve => window.setTimeout(() => {`

    warnOnIframe = (href) => `\n\t\t//THIS ACTION IS EXECUTED IN CONTEXT OF IFRAME WITH ORIGIN: ${new URL(href).origin}`

    closeTimedFunction = (delay) => `\n\t\tresolve(); \n\t}, ${delay}));\n`

    tabIndex = index => {
        switch(index) {
            //for the first element in any recording event array, we do not need the timing so we don't need the indentation
            case 0: return '\n\t';
            //for one extra tab, we use -1
            case -1: return '\n\t\t\t';
            //for two extra tabs we use -2
            case -2: return '\n\t\t\t\t';
            //for any element above zero, we use normal tabbing
            default: return '\n\t\t';
        }
    }

    //BROWSER CONTROL ACTIONS

    openPage = () => `${this.tabIndex(0)}const page = await browser.newPage();\n`

    navigateToUrl = url => `${this.tabIndex(0)}await page.goto('${url}');\n`

    returnScreenshot = () => `${this.tabIndex(0)}await page.screenshot({path: 'screenshot.png'});\n` 

    closePage = () => `${this.tabIndex(0)}await page.close();\n`

    connectToChromeDevtools = () => `${this.tabIndex(0)}const client = await page.target().createCDPSession();\n` 

    emulateNetworkConditions = (offline = this.defaultNetworkOffline, download = this.defaultNetworkDownload, upload = this.defaultNetworkUpload, latency = this.defaultLatency) => {

        return `${this.tabIndex(0)}await client.send('Network.emulateNetworkConditions', { offline: ${offline}, downloadThroughput: ${download}, uploadThroughput: ${upload}, latency: ${latency} });\n`;

    }

    //ACTION FUNCTIONS

    mapDispatchKeyEventModifer = (modifier) => {
        switch(modifier) {
            case 1: return "Alt"
            case 2: return "Control"
            case 4: return "Meta"
            case 8: return "Shift"
            default: return ""
        }
    }

    mouseClick = (selector, clicktype, index, target) => {
        switch(clicktype) {
            case 'click': return `await ${target}.click('${selector}', { button: 'left', clickCount: 1 } );`
            case 'dblclick': return `await ${target}.click('${selector}', { button: 'left', clickCount: 2 } );`
            case 'contextmenu': return `await ${target}.click('${selector}', { button: 'right', clickCount: 1 } );`
            default: return `${this.tabIndex(index)}//No Click Action Available For Action ${clicktype}`
        }
    }

    recaptcha = (selector, target) => `await ${target}.click('${selector}', { button: 'left', clickCount: 1 } );`

    //Note you should always focus before you type
    typeText = (text, target) => `await ${target}.keyboard.type('${text}');`

    //Note you should always focus before you send key as tab, enter etc may only have meaning in the context of focus
    nonInputTyping = (selector, replayEvent, index) => {
        //so there is some complexity in handling the different types of typing
        //first we need to know if the typing event contains characters or not
        const dictionaryEntry = this.keyCodeDictionary[replayEvent.recordingEventDispatchKeyEvent.windowsVirtualKeyCode];
        //then we want to know if there are any modifier keys pressed at the time
        const modifiers = this.mapDispatchKeyEventModifer(replayEvent.recordingEventDispatchKeyEvent.modifiers);
        //then we want to know if the action happened on the main html document or not
        let prependForTarget = '';
        //if the target was not the html, we need to focus
        if (replayEvent.recordingEventHTMLTag == "HTML") { prependForTarget = `await ${target}.focus('${selector}');${this.tabIndex(index)}` }
        //then we need to work on the modifier, if present
        if (modifiers.length > 0) {
            return `${prependForTarget}await page.keyboard.down('${modifiers}');${this.tabIndex(index)}await page.keyboard.press('${dictionaryEntry.descriptor}');${this.tabIndex(index)}await page.keyboard.up('${modifiers}');`
        } else {
            return `${prependForTarget}await page.keyboard.press('${dictionaryEntry.descriptor}');`
        }
    }

    scrollTo = (xPosition, yPosition, index, target) => `await ${target}.evaluate( () => { ${this.tabIndex(-1)} document.documentElement.scrollTo({ left: ${xPosition}, top: ${yPosition}, behavior: 'smooth' }); ${this.tabIndex(index)} });`

    elementScrollTo = (selector, xPosition, yPosition, index, target) => `await ${target}.evaluate( () => { ${this.tabIndex(-1)} document.querySelector('${selector}').scrollTo({ left: ${xPosition}, top: ${yPosition}, behavior: 'smooth' }); ${this.tabIndex(index)} });`

    focus = (selector, target) => `await ${target}.focus('${selector}');`

    hover = (selector, target) => `await ${target}.hover('${selector}');` 

    textSelect = (selector, index, target) => `await ${target}.evaluate( () => { ${this.tabIndex(-1)}const range${index} = document.createRange(); ${this.tabIndex(-1)}const referenceNode${index} = document.querySelector('${selector}'); ${this.tabIndex(-1)}range${index}.selectNode(referenceNode${index}); ${this.tabIndex(-1)}const currentSelection${index} = window.getSelection(); ${this.tabIndex(-1)}currentSelection${index}.removeAllRanges(); ${this.tabIndex(-1)}currentSelection${index}.addRange(range${index}); ${this.tabIndex(index)} });`


    //ASSERTIONS HELPERS, we need to have the index of each item in the Rx.js flow so we can have unique assertions

    getPageTitle = () => `await page.title();`

    querySelector = (selector, index) => `const selected${index} = await page.$('${selector}');` 

    querySelectorAll = (selector, index) => `const selectedAll${index} = await page.$$('${selector}');` 

    countElements = (selector, index) => `const count${index} = await page.$$eval('${selector}', elements => elements.length);`

    getElementProperty = (selector, property, index) => `const ${property}Property${index} = await page.$eval('${selector}', element => element.${property});`

    getElementAttributeValue = (selector, attribute, index) => `const ${attribute}Attribute${index} = await page.$eval('${selector}', element => element.getAttribute('${attribute}');`

    getElementAttributesAsArray = (selector, index) => `const attributesArray${index} = await page.$eval('${selector}', element => Array.prototype.slice.call(element.attributes);`

    getMostValidSelector = replayEvent => {

        //if we have run the replay, we will get a report on the selector that was chosen
        if (replayEvent.replayChosenSelectorString && replayEvent.replayChosenSelectorString.length > 0) {
            return replayEvent.replayChosenSelectorString;
        }
        //if we have run the assertion, we will get a report on the selector that was chosen
        if (replayEvent.assertionChosenSelectorString && replayEvent.assertionChosenSelectorString.length > 0) {
            return replayEvent.assertionChosenSelectorString;
        }
        //otherwise collect all the existing selectors into an array, filter and return the first valid one
        return [
            replayEvent.recordingEventCssSelectorPath, 
            replayEvent.recordingEventCssFinderPath, 
            replayEvent.recordingEventCssDomPath
        ]
        //when we filter we need to know what the selectors return when they fail
        .filter(value => value != false && value != 'undefined' && value != null)[0] || ""; 

    }

    mapActionTypeToFunction = (recordingEvent, index) => {

        //we have to work out if the recording event has taken place in an iframe because the syntax is different in Puppeteer
        //first we need to create the variable for our target
        let target;
        //then we need to create an array that we can push our strings into then join them at the end
        let outputStringArray = [];
        //then we need to find out if the event has taken place in an iframe
        if (recordingEvent.recordingEventIsIframe) {
            //first we need to get the details of the iframe we are going to be looking for
            const recordingFrameUrl = new URL(recordingEvent.recordingEventLocationHref)
            //then we need to get the origin and the path
            const recordingFrameOrigin = recordingFrameUrl.origin;
            const recordingFramePath = recordingFrameUrl.pathname;
            //then we need to find the frame using the origin and path and allocate it to our indexed frame
            var getFrameString = `const frame${index} = page.frames().find(frame => frame.url().includes('${recordingFrameOrigin}') && frame.url().includes('${recordingFramePath}'));`;
            //then push the frame string to the array
            outputStringArray.push(getFrameString);
            //then we set the target to be the indexed frame
            target = `frame${index}`;
        } else {
            //this is the easy case, the target is just the page
            target = 'page';
        }
        
        //then we need to determine the type of recording event action so we can deliver the right piece of code to the text area
        switch(recordingEvent.recordingEventAction) {
            //mouse actions can have many variants so we need a subswitch
            case "Mouse":
                //here we switch on type of action
                switch(recordingEvent.recordingEventActionType) {
                    case "hover":
                        //in the case of hover, we get the most valid selector and then push the string result of the hover selctor into the array 
                        outputStringArray.push(this.hover(this.getMostValidSelector(recordingEvent), target));
                        break;
                    case "recaptcha":
                        //recaptcha is different in recording terms as the event we listen to is not the event we replay - click to replay 
                        outputStringArray.push(this.recaptcha(this.getMostValidSelector(recordingEvent), target));
                        break;
                    default:
                        //then we have the default, which handles all the standard clicks, including 'click', 'dblclick' and 'contextmenu'
                        outputStringArray.push(this.mouseClick(this.getMostValidSelector(recordingEvent), recordingEvent.recordingEventActionType, index, target));
                }
                break;
            //scroll has no particular solution in Puppeteer
            case "Scroll":
                outputStringArray.push(this.scrollTo(recordingEvent.recordingEventXPosition, recordingEvent.recordingEventYPosition, index, target));
                break;
            case "ElementScroll":
                outputStringArray.push(this.elementScrollTo(this.getMostValidSelector(recordingEvent), recordingEvent.recordingEventXPosition, recordingEvent.recordingEventYPosition, index, target));
                break;
            //neither does text select
            case "TextSelect":
                outputStringArray.push(this.textSelect(this.getMostValidSelector(recordingEvent), index, target));
                break;
            case "Keyboard": 
                outputStringArray.push(this.nonInputTyping(this.getMostValidSelector(recordingEvent), recordingEvent, index));
                break;
            case 'Input':
                outputStringArray.push(this.focus(this.getMostValidSelector(recordingEvent), target) += this.tabIndex(index) + this.typeText(recordingEvent.recordingEventInputValue, target));
                break;
            case 'Page':
                //here we just do a simple return with the standard tabbing
                return `${this.tabIndex(0)}// Page navigated to ${recordingEvent.recordingEventLocationHref}`;
            default:
                console.log(`No Mapping for Action Type ${recordingEvent.recordingEventAction}`);
                //here we do a simple return with the indented tabbing so it falls in the same place as the action
                return `${this.tabIndex(index)}//No Mapping Type in Puppeteer for Action ${recordingEvent.recordingEventAction}`; 
        }

        //then if we reach this point we need to mao the string array, with a tabbing element for formatting
        outputStringArray = outputStringArray.map(string => `${this.tabIndex(index)}${string}`);
        //then we need to return the string
        return outputStringArray.join('');

    }

    buildRecordingStringFromEvents = recording => {

        //start with an empty string
        var outputString = "";
        //add the standard opening comment
        outputString += this.standardRecordingComment;
        //add the standard async opening function
        outputString += this.openAnonAsyncFunction();
        //add the standard browser warning
        outputString += this.standardOpeningComment;
        //add the open page function
        outputString += this.openPage();
        //open a connection to Chrome DevTools Protocol
        outputString += this.connectToChromeDevtools();
        //set the network conditions
        outputString += this.emulateNetworkConditions(false, recording.recordingTestBandwidthValue, recording.recordingTestBandwidthValue, recording.recordingTestLatencyValue)
        //add the navigate to page function
        outputString += this.navigateToUrl(recording.recordingTestStartUrl);
        //then we loop through the array
        for (let recordingEventIndex in recording.recordingEventArray) { 
            //make sure we have a recording event with defaults
            var eachEvent = new RecordingEvent(recording.recordingEventArray[recordingEventIndex]);
            //if we are on the first event, just push according to event
            if (recordingEventIndex == 0) {
                outputString += `${this.mapActionTypeToFunction(eachEvent, recordingEventIndex)}\n`;
            //otherwise we need to wrap in the setTimeout
            } else {
                //open the async timeout function
                outputString += this.openTimedFunction();
                //then add the iframe warning if required
                eachEvent.recordingEventIsIframe ? outputString += this.warnOnIframe(eachEvent.recordingEventLocationHref) : null;
                //map the action to the function and return string
                outputString += `${this.mapActionTypeToFunction(eachEvent, recordingEventIndex)}`;
                //close the async timeout function
                outputString += this.closeTimedFunction(eachEvent.recordingTimeSincePrevious);
            }
        }
        //add the close page function
        outputString += this.closePage();
        //add the standard async closing function
        outputString += this.closeAnonAsyncFunction();
        //return the string
        return outputString;

    }
  
}