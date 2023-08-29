var ajaxCall = (key, url, messages) => {
  return new Promise((resolve, reject) => {
    $.ajax({
      url: url,
      type: "POST",
      dataType: "json",
      data: JSON.stringify({
        // model: "gpt-3.5-turbo-0613",
        // max_tokens: 1024,
        model: "gpt-4",
        max_tokens: 4096,
        messages: messages,
        n: 1,
        temperature: 0.3,
      }),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      crossDomain: true,
      success: function (response, status, xhr) {
        resolve({ response, status, xhr });
      },
      error: function (xhr, status, error) {
        const err = new Error('xhr error');
        err.status = xhr.status;
        reject(err);
      },
    });
  });
};

const url = "https://api.openai.com/v1";

(function () {
  const template = document.createElement("template");
  template.innerHTML = `
      <style>
      </style>
      <div id="root" style="width: 100%; height: 100%;">
      </div>
    `;
  class MainWebComponent extends HTMLElement {
    constructor () {
      super();
      this.pyodide = null;
      this.messageArray = null;
      this.fetchPyodide();
      this.fetchResultSet();
    }

    // Funtion to load pyodide
    async fetchPyodide () {
      await getScriptPromisify('https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js')
      const pyodide = await loadPyodide()
      this.pyodide = pyodide
    }

    // Function to run python code in pyodide
    async runPythonCode(code){
      const codeOutput = await this.pyodide.runPythonAsync(code);
      return codeOutput;
    }

    // Function to remove unnecessary properties from dimensions and measures to reduce dataset size
    function trimResultSet(obj) {
      for (const key in obj) {
        if (key !== "description" && key !== "rawValue") {
          delete obj[key];
          }
        }
      }

    // Function for getting data from the model bound to the widget
    async function fetchResultSet() {
      try {
        resultSet = await this.dataBindings.getDataBinding("myDataBinding").getDataSource().getResultSet();
        
        // Remove unnecessary properties from dimensions and measures to reduce dataset size
        for (const obj of resultSet) {
            for (const key in obj) {
                if (typeof obj[key] === 'object') {
                    this.trimResultSet(obj[key]);
                }
            }
        }
        this.resultSet = JSON.stringify(resultSet);
      }
        catch (error) {
          console.error('Error in Fetching Dataset:', error);
          }
      }
    
    // Function for getting data from the model bound to the widget
    async function prepareMessages() {
      try {
        let messageArray = [];
        
        const regex_quote = new RegExp("\"", "g");
        const regex_newline = new RegExp("\\n", "g");
  
        // Managing conversation history to maintain session
        // The first message contains dataset in JSON format and instructions to ChatGPT
        var instructions = "You are my laconic assistant. Read the below data in JSON format from SAP Analytics Cloud. Only answer compact python code <code> to determine the answer to further questions with no other text. I will myself pass it to exec(<code>, {'json_data', json.loads(json_data)}), where json_data = " + this.resultSet + "\n\nStore the final result in variable 'output'.";
        instructions = instructions.replace(regex_quote, "\\\"");
        var firstMessage = '{"role": "system", "content": "' + instructions + '"}';
        const messageObject = JSON.parse(firstMessage.replace(regex_newline, "\\\\n"));        
        messageArray.push(messageObject);

        for (const promptString of prompt) {
          try {
            const messageObject = JSON.parse(promptString.replace(regex_newline, "\\\\n"));
            messageArray.push(messageObject);
            } catch (error) {
            console.error('Error parsing Prompt JSON:', error);
            }
          }
        console.log(["messageArray", messageArray]);
        } catch (error) {
        console.error('Error in preparing Messages:', error);
        }
      }
    
    async post(apiKey, endpoint, prompt) {

      // Getting data from the model bound to the widget
      const messageArray = await this.prepareMessages();
      console.log("messageArray", messageArray);

      // API call to ChatGPT
      const { response } = await ajaxCall(
        apiKey,
        `${url}/${endpoint}`,
        messageArray
      );
      console.log(response);
      const output = response.choices[0].message.content.replace(/["']/g, '');
      console.log(output);
      return output;
    }
  }
