class jQueryTranslator {

    //pass in an options object which can take new languages
    constructor(options) {
        
        // set default values for the keycodes class 
        const defaults = {

            //internal defaults
            recordingTestUrl: "",
            recordingTestID: 0,
            //messaging for code
            standardRecordingComment: "/*\n" 
            + "\t This is jQuery code generated by Record/Replay from a RECORDING. \n"
            + "\t As such it only contains ACTIONS, not ASSERTIONS.\n"
            + "\t If you want to have code with assertions included, you need to generate a replay of this recording and download the replay code.\n"
            + "*/\n\n"

        }
        // create a new object with the defaults over-ridden by the options passed in
        let opts = Object.assign({}, defaults, options);
  
        // assign options to instance data (using only property names contained in defaults object to avoid copying properties we don't want)
        Object.keys(defaults).forEach(prop => { this[prop] = opts[prop]; });
    }

    //FORMATTING FUNCTIONS

    openAnonAsyncFunction = () => `(async ($) => {\n`

    closeAnonAsyncFunction = () => `\n})(jQuery);` 

    openTimedFunction = () => `\n\tawait new Promise(resolve => window.setTimeout(() => {`

    warnOnIframe = (href) => `\n\t\t//THIS ACTION MUST BE EXECUTED IN CONTEXT OF IFRAME WITH ORIGIN: ${new URL(href).origin}`

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

    //ACTIONS

    mouseClick = (selector, clicktype, index) => {
        switch(clicktype) {
            case 'click': return `$('${selector}').click();`
            case 'dblclick': return `$('${selector}').dblclick();`
            case 'contextmenu': return `$('${selector}').contextmenu();`
            default: return `${this.tabIndex(index)}//No Click Action Available For Action ${clicktype}`
        }
    }

    recaptcha = (selector) => `$('${selector}').click();`

    inputText = (selector, text) => `$('${selector}').val('${text}');`

    inputContentEditable = (selector, text) => `$('${selector}').text('${text}');`

    nonInputTyping = (selector, recordingEvent, index) => {

        //first we need a shorthand of our event
        const dispatchEvent = recordingEvent.recordingEventDispatchKeyEvent;
        //then we need each of the modifier keys
        const ctrlKey = (dispatchEvent.modifiers == 2 ? 'true' : 'false');
        const shiftKey = (dispatchEvent.modifiers == 8 ? 'true' : 'false');
        const altKey = (dispatchEvent.modifiers == 1 ? 'true' : 'false');
        const metaKey = (dispatchEvent.modifiers == 4 ? 'true' : 'false');
        //then we need to know if the target was the main document or not
        //then we want to know if the action happened on the main html document or not
        let prependForTarget = '';
        //if the target was not the html, we need to focus on the right element using the selector
        if (recordingEvent.recordingEventHTMLTag == "HTML") { prependForTarget = `document.querySelector('${selector}').focus({ preventScroll: false });${this.tabIndex(index)}` }
        //then we just need to return the string
        return `${prependForTarget}const event${index} = new KeyboardEvent('keypress', { key: ${dispatchEvent.key}, code: ${dispatchEvent.code}, location: ${dispatchEvent.location}, repeat: ${dispatchEvent.autoRepeat}, ctrlKey: ${ctrlKey}, shiftKey: ${shiftKey}, altKey: ${altKey}, metaKey: ${metaKey}}); ${this.tabIndex(index)}document.dispatchEvent( event${index} );`

    }

    scrollTo = (xPosition, yPosition) => `$('html').animate({ scrollLeft: ${xPosition}, scrollTop: ${yPosition} }, 500);`

    elementScrollTo = (selector, xPosition, yPosition) => `$('${selector}').animate({ scrollLeft: ${xPosition}, scrollTop: ${yPosition} }, 500);`

    focus = selector => `$('${selector}').focus();`

    hover = selector => `$('${selector}').mouseenter();`

    textSelect = (selector, index) => `const range${index} = document.createRange(); ${this.tabIndex(index)}const referenceNode${index} = document.querySelector('${selector}'); ${this.tabIndex(index)}range${index}.selectNode(referenceNode${index}); ${this.tabIndex(index)}const currentSelection${index} = window.getSelection(); ${this.tabIndex(index)}currentSelection${index}.removeAllRanges(); ${this.tabIndex(index)}currentSelection${index}.addRange(range${index});`;

    //ASSERTIONS HELPERS

    getTitle = (selector='document', index) => selector == 'document' ? `const title${index} = $(document).attr('title');` : `const title${index} = $('${selector}').attr('title');`

    querySelector = (selector, index) => `const $selected${index} = $('${selector}').first();`

    querySelectorAll = selector => `const $selected${index} = $('${selector}');`

    countElements = (selector, index) => `const $count${index} = $('${selector}').length;`

    getElementProperty = (selector, property, index) => `const $property${index} = $('${selector}').prop('${property}');`

    getElementAttributeValue = (selector, attribute, index) => `const ${attribute}$Attribute${index} = $('${selector}').attr('${attribute}');`

    getElementAttributesAsArray = (selector, index) => `const attributesArray${index} = Array.prototype.slice.call(document.querySelector('${selector}').attributes);`

    //RETURN STRING FUNCTIONS

    getMostValidSelector = recordingEvent => {
        //collect all the existing selectors into an array, filter and return the first valid one
        return [
            recordingEvent.recordingEventCssSelectorPath, 
            recordingEvent.recordingEventCssFinderPath, 
            recordingEvent.recordingEventCssDomPath
        ]
        //when we filter we need to know what the selectors return when they fail
        .filter(value => value != false && value != 'undefined' && value != null)[0] || ""; 

    }

    mapActionTypeToFunction = (recordingEvent, index) => {
        switch(recordingEvent.recordingEventAction) {
            case "Mouse":
                switch(recordingEvent.recordingEventActionType) {
                    case "hover":
                        return this.hover(this.getMostValidSelector(recordingEvent));
                    case "recaptcha":
                        return this.recaptcha(this.getMostValidSelector(recordingEvent));
                    default:
                        return this.mouseClick(this.getMostValidSelector(recordingEvent), recordingEvent.recordingEventActionType, index);
                }
            case "Scroll":
                return this.scrollTo(recordingEvent.recordingEventXPosition, recordingEvent.recordingEventYPosition);
            case "ElementScroll":
                return this.elementScrollTo(this.getMostValidSelector(recordingEvent), recordingEvent.recordingEventXPosition, recordingEvent.recordingEventYPosition);
            case "TextSelect":
                return this.textSelect(this.getMostValidSelector(recordingEvent), index);
            case "Keyboard": 
                return this.nonInputTyping(this.getMostValidSelector(recordingEvent), recordingEvent, index);
            case 'Input':
                if (recordingEvent.recordingEventInputType == "contentEditable") {
                    return this.inputContentEditable(this.getMostValidSelector(recordingEvent), recordingEvent.recordingEventInputValue);
                } else {
                    return this.inputText(this.getMostValidSelector(recordingEvent), recordingEvent.recordingEventInputValue);
                }
            case 'Page':
                return `// Page navigated to ${recordingEvent.recordingEventLocationHref}`; 
            default:
                console.log(`No Mapping for Action Type ${recordingEvent.recordingEventAction}`);
                return `// No Mapping Type in jQuery for Action ${recordingEvent.recordingEventAction}`; 
        }
    }

    buildRecordingStringFromEvents = eventsArray => {

        //start with an empty string
        var outputString = "";
        //add the standard opening comment
        outputString += this.standardRecordingComment;
        //add the standard async opening function
        outputString += this.openAnonAsyncFunction();
        //then we loop through the array
        for (let recordingEventIndex in eventsArray) { 
            //make sure we have a recording event with defaults
            var eachEvent = new RecordingEvent(eventsArray[recordingEventIndex]);
            //if we are on the first event, just push according to event
            if (recordingEventIndex == 0) {
                outputString += `${this.tabIndex(0)}${this.mapActionTypeToFunction(eachEvent, recordingEventIndex)}\n`;
            //otherwise we need to wrap in the setTimeout
            } else {
                //open the async timeout function
                outputString += this.openTimedFunction();
                //then add the iframe warning if required
                eachEvent.recordingEventIsIframe ? outputString += this.warnOnIframe(eachEvent.recordingEventLocationHref) : null;
                //map the action to the function and return string
                outputString += `${this.tabIndex(recordingEventIndex)}${this.mapActionTypeToFunction(eachEvent, recordingEventIndex)}`;
                //close the async timeout function
                outputString += this.closeTimedFunction(eachEvent.recordingTimeSincePrevious);
            }
        }
        //add the standard async closing function
        outputString += this.closeAnonAsyncFunction();
        //return the string
        return outputString;

    }
  
}