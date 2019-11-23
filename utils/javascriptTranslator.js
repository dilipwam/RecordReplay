class JavascriptTranslator {

    //pass in an options object which can take new languages
    constructor(options) {
        
        // set default values for the keycodes class 
        const defaults = {

            //internal defaults
            recordingTestUrl: "",
            recordingTestID: 0,
            //messaging for code
            standardRecordingComment: "/*\n" 
            + "\t This is Javascript code generated by Record/Replay from a RECORDING. \n"
            + "\t As such it only contains ACTIONS, not ASSERTIONS.\n"
            + "\t If you want to have code with assertions included, you need to generate a replay of this recording and download the replay code.\n"
            + "*/\n\n"

        }
        // create a new object with the defaults over-ridden by the options passed in
        let opts = Object.assign({}, defaults, options);
  
        // assign options to instance data (using only property names contained in defaults object to avoid copying properties we don't want)
        Object.keys(defaults).forEach(prop => { this[prop] = opts[prop]; });
    }

    //FORMATTING
    openAnonAsyncFunction = () => `(async () => { \n`

    closeAnonAsyncFunction = () => `\n})();`
    
    openTimedFunction = () => `\n\tawait new Promise(resolve => setTimeout({`

    closeTimedFunction = (delay) => `\n\t\t resolve(); \n\t}, ${delay}));\n`

    //ACTIONS

    mouseClick = (selector, clicktype) => ` const event = document.createEvent('Events'); event.initEvent(${clicktype}, true, false); document.querySelector('${selector}').dispatchEvent( event ); `

    inputText = (selector, text) => ` document.querySelector('${selector}').value = '${text}';  ` 



    //TO DO Note you should always focus before you send key as tab, enter etc may only have meaning in the context of focus
    sendSpecialKey = keyCode => ` const event = new KeyboardEvent('keydown',{'key': ${keyCode}}); document.querySelector('${selector}').dispatchEvent(event); `



    //TODO - check smooth scroll style key name
    scrollTo = (xPosition, yPosition) => ` window.scrollTo({left: ${xPosition}, top: ${yPosition}, scroll: 'smooth'}); `

    focus = selector => ` const event = document.createEvent('Events'); event.initEvent('mouseover', true, false); document.querySelector('${selector}').dispatchEvent( event ); `

    hover = selector => ` const event = document.createEvent('Events'); event.initEvent('focus', true, false); document.querySelector('${selector}').dispatchEvent( event ); `

    //ASSERTIONS HELPERS

    getTitle = (selector='document', index) => selector == 'document' ? ` const title${index} = document.title; ` : ` const title${index} = document.querySelector('${selector}').title; `

    querySelector = (selector, index) => ` const selected${index} = document.querySelector('${selector}'); `

    querySelectorAll = (selector, index) => ` const selected${index} = document.querySelectorAll('${selector}'); `

    countElements = (selector, index) => ` const count${index} = Array.prototype.slice.call(document.querySelectorAll('${selector}')).length; `

    getElementProperty = (selector, property, index) => ` const property${index} = document.querySelector('${selector}').${property}; `

    getElementAttributeValue = (selector, attribute, index) => ` const ${attribute}Attribute${index} = document.querySelector('${selector}').getAttribute('${attribute}'); `

    getElementAttributesAsArray = (selector, index) => ` const attributesArray${index} = Array.prototype.slice.call(document.querySelector('${selector}').attributes); `

  
}