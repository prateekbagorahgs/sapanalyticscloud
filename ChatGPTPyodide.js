var getScriptPromisify = (src) => {
    return new Promise(resolve => {
        $.getScript(src, resolve);
    })
}

var ajaxCall = (key, url, messages) => {
    return new Promise((resolve, reject) => {
        $.ajax({
            url: url,
            type: "POST",
            dataType: "json",
            data: JSON.stringify({
                // model: "gpt-4",
                // max_tokens: 4096,
                model: "gpt-3.5-turbo",
                max_tokens: 1024,
                messages: messages,
                n: 1,
                temperature: 0.3,
            }),
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${key}`,
            },
            crossDomain: true,
            success: function(response, status, xhr) {
                resolve({
                    response,
                    status,
                    xhr
                });
            },
            error: function(xhr, status, error) {
                const err = new Error('xhr error');
                err.status = xhr.status;
                reject(err);
            },
        });
    });
};

const url = "https://api.openai.com/v1";

(function() {
    const template = document.createElement("template");
    template.innerHTML = `
      <style>
      </style>
      <div id="root" style="width: 100%; height: 100%;">
      </div>
    `;
    class MainWebComponent extends HTMLElement {
        constructor() {
            super();
            this.pyodide = null;
            this.fetchPyodide();
        }

        // Funtion to load pyodide
        async fetchPyodide() {
            await getScriptPromisify('https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js');
            const pyodide = await loadPyodide();
            this.pyodide = pyodide;
            console.log(["pyodide", this.pyodide]);
        }

        // Function to remove unnecessary properties from dimensions and measures to reduce dataset size
        trimResultSet(obj) {
            for (const key in obj) {
                if (key !== "description" && key !== "rawValue") {
                    delete obj[key];
                }
            }
        }

        // Function for getting data from the model bound to the widget
        async fetchResultSet() {
            try {
                var resultSet = await this.dataBindings.getDataBinding("myDataBinding").getDataSource().getResultSet();

                // Remove unnecessary properties from dimensions and measures to reduce dataset size
                for (const obj of resultSet) {
                    for (const key in obj) {
                        if (typeof obj[key] === 'object') {
                            this.trimResultSet(obj[key]);
                        }
                    }
                }
                resultSet = JSON.stringify(resultSet);
                return resultSet
            } catch (error) {
                console.error('Error in Fetching Dataset:', error);
            }
        }

        // Function for getting data from the model bound to the widget
        async prepareMessages(resultSet, prompt) {
            try {
                let messageArray = [];

                const regex_quote = new RegExp("\"", "g");
                const regex_newline = new RegExp("\\n", "g");

                // Managing conversation history to maintain session
                // The first message contains dataset in JSON format and instructions to ChatGPT
                var instructions = "You are my laconic assistant. Read the below data in JSON format from SAP Analytics Cloud. Only answer compact python code <code> to determine the answer to further questions with no other text. I will myself pass it to exec(<code>, {'json_data', json.loads(json_data)}), where json_data = " + resultSet + "\n\nStore the final result in variable 'output' as a descriptive string understandable to business users.";
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
                return messageArray;
            } catch (error) {
                console.error('Error in preparing Messages:', error);
            }
        }

        // Function to create executable pyhton code
        async fetchExecutableCode() {

            var codePython = "import json;\n";
            codePython = codePython + "json_data = json.loads(resultSet)\n";
            codePython = codePython + "exec(codeChatGPT, globals())\n";
            codePython = codePython + "print(output)";
            return codePython;
        }

        // Function to run python code in pyodide
        async runPythonCode(resultSet, codeChatGPT, codePython) {

            this.pyodide.globals.set("resultSet", resultSet);
            this.pyodide.globals.set("codeChatGPT", codeChatGPT);
            this.pyodide.globals.set("output", "");

            try {
                await this.pyodide.runPythonAsync(codePython);
            } catch (error) {
                console.error("Error in pyodide code execution.", error);
            }
        }

        // Main function
        async post(apiKey, endpoint, prompt) {

            // Getting data from the model bound to the widget
            const resultSet = await this.fetchResultSet();
            const messageArray = await this.prepareMessages(resultSet, prompt);

            // API call to ChatGPT
            const {
                response
            } = await ajaxCall(
                apiKey,
                `${url}/${endpoint}`,
                messageArray
            );
            const codeChatGPT = response.choices[0].message.content;
            const codePython = await this.fetchExecutableCode();
            await this.runPythonCode(resultSet, codeChatGPT, codePython);
            const codeOutput = this.pyodide.globals.get("output");
            console.log(["codeOutput", codeOutput]);
            return codeOutput;
        }
    }
    customElements.define("chatgpt-pyodide-widget", MainWebComponent);
})();
