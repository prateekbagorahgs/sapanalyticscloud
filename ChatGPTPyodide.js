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
                // model: "gpt-3.5-turbo",
                // max_tokens: 1024,
                model: "gpt-4",
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
            this.resultSet = null;
            this.sampleSet = null;
            this.codePython = this.fetchPythonCode();
            this.pyodide = null;
            this.fetchPyodide();
        }

        // Funtion to load pyodide
        async fetchPyodide() {
            try {
                await getScriptPromisify('https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js');
                const pyodide = await loadPyodide();
                this.pyodide = pyodide;
                await this.pyodide.loadPackage('pandas');
                console.log(["Pyodide loaded successfully."]);
            } catch (error) {
                console.error("Unable to load pyodide: ", error);
            }
        }

        // Function to create executable python code
        fetchPythonCode() {
            var codePython = "import json;\n";
            codePython = codePython + "json_data = json.loads(resultSet)\n";
            codePython = codePython + "exec(codeChatGPT, globals())\n";
            codePython = codePython + "print(output)";
            return codePython;
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
                return resultSet;
            } catch (error) {
                console.error("Unable to fetch dataset: ", error);
            }
        }

        replaceWithDummy(item) {
            if (typeof item === 'object') {
                if (Array.isArray(item)) {
                    for (let i = 0; i < item.length; i++) {
                        item[i] = this.replaceWithDummy(item[i]);
                    }
                } else {
                    for (const key in item) {
                        if (item.hasOwnProperty(key)) {
                            item[key] = this.replaceWithDummy(item[key]);
                        }
                    }
                }
            } else {
                if (typeof item === 'string') {
                    item = 'abcd';
                } else if (typeof item === 'number') {
                    item = 0;
                } else if (typeof item === 'boolean') {
                    item = false;
                } else if (item === null) {
                    item = null;
                }
            }
            return item;
        }

        // Function for getting data from the model bound to the widget
        async prepareMessages(prompt) {
            try {
                let messageArray = [];

                const regex_quote = new RegExp("\"", "g");
                const regex_newline = new RegExp("\\n", "g");

                // Managing conversation history to maintain session
                // The first message contains dataset in JSON format and instructions to ChatGPT
                var instructions = "You are my laconic python developer. Refer to below JSON format of json_data from SAP Analytics Cloud. Only answer compact pyodide python code <code> to determine the answer to further questions. I will myself pass it to exec(<code>, {'json_data', json.loads(json_data)}).\n\nHere, json_data looks like " + JSON.stringify(this.sampleSet) + "The <code> should store the final result in variable 'output' as a descriptive string understandable to business users.";
                instructions = instructions.replace(regex_quote, "\\\"");
                var firstMessage = '{"role": "system", "content": "' + instructions + '"}';
                var messageObject = JSON.parse(firstMessage.replace(regex_newline, "\\\\n"));
                messageArray.push(messageObject);

                for (const promptString of prompt) {
                    try {
                        const messageObject = JSON.parse(promptString.replace(regex_newline, "\\\\n"));
                        messageArray.push(messageObject);
                    } catch (error) {
                        console.error("Error parsing prompt JSON: ", error);
                    }
                }
                return messageArray;
            } catch (error) {
                console.error("Could not prepare messages: ", error);
            }
        }

        // Function to run python code in pyodide
        async runPythonCode(codeChatGPT) {
            this.pyodide.globals.set("resultSet", JSON.stringify(this.resultSet));
            this.pyodide.globals.set("codeChatGPT", codeChatGPT);
            this.pyodide.globals.set("output", "");
            try {
                await this.pyodide.runPythonAsync(this.codePython);
            } catch (error) {
                console.error("Could not execute pyodide code: ", error);
            }
        }

        // Function to prepare result set and sample set
        async prepareDataSet() {
            if (this.resultSet === null) {
                try {
                    this.resultSet = await this.fetchResultSet();
                    this.sampleSet = this.replaceWithDummy(this.resultSet[0]);
                } catch (error) {
                    console.error("Could not create result set and sample set", error);
                }
            }
        }

        // Main function
        async post(apiKey, endpoint, prompt) {
            try {

                // Prepare result set and sample set
                // this.resultSet = await this.fetchResultSet();
                // this.sampleSet = this.replaceWithDummy(this.resultSet[0]);

                this.prepareDataSet();
                console.log(["resultSet", this.resultSet]);
                console.log(["sampleSet", this.sampleSet]);

                // Prepare messages for ChatGPT
                const messageArray = await this.prepareMessages(prompt);
                console.log(["messageArray", messageArray]);

                // API call to ChatGPT
                /*
                const {
                    response
                } = await ajaxCall(
                    apiKey,
                    `${url}/${endpoint}`,
                    messageArray
                );
                const codeChatGPT = response.choices[0].message.content;
                console.log(["codeChatGPT", codeChatGPT]);
                */

                const codeChatGPT = `output = {item['Vendor']['description']: 0 for item in json_data if item['@MeasureDimension']['description'] == 'Order Qty'}\nfor item in json_data:\n    if item['@MeasureDimension']['description'] == 'Order Qty':\n        output[item['Vendor']['description']] += int(item['@MeasureDimension']['rawValue'])\noutput = ', '.join([f'{k}: {v}' for k, v in output.items()])`;

                // Execte python code in pyodide
                await this.runPythonCode(codeChatGPT);

                // Get output from pyodide environment
                const codeOutput = this.pyodide.globals.get("output");
                console.log(["codeOutput", codeOutput]);

                return codeOutput;

            } catch (error) {
                console.error("Could not execute the post request: ", error);
            }
        }
    }
    customElements.define("chatgpt-pyodide-widget", MainWebComponent);
})();
