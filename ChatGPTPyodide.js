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

        // Function to replace in sample data with dummy values
        replaceWithDummy(type, key, item, isMeasure) {
            if (typeof item === 'object') {
                if (Array.isArray(item)) {
                    for (let i = 0; i < item.length; i++) {
                        item[i] = this.replaceWithDummy(null, null, item[i], false);
                    }
                } else {
                    for (const key in item) {
                        if (typeof item[key] === 'object') {
                            if (key === "@MeasureDimension") {
                                item[key] = this.replaceWithDummy(key, key, item[key], true);
                            } else {
                                item[key] = this.replaceWithDummy(key, key, item[key], isMeasure);
                            }
                        } else {
                            item[key] = this.replaceWithDummy(type, key, item[key], isMeasure);
                        }
                    }
                }
            } else {
                if (isMeasure && !isNaN(Number(item))) {
                    item = Math.round(item * Math.random()) + "";
                } else if (!isMeasure) {
                    if (!isNaN(new Date(item))) {
                        item = "01/01/1991";
                    } else if (typeof item === "string") {
                        item = "Dummy " + type + " " + Math.round(Math.random() * 100);
                    }
                }
            }
            return item;
        }

        // Function for getting sample data for the model bound to the widget
        async fetchSampleSet() {
            try {
                var measures = await this.dataBindings.getDataBinding("myDataBinding").getDataSource().getMeasures();
                var sampleSet = [];

                for (const obj of measures) {
                    if (typeof obj === 'object') {
                        this.trimResultSet(obj);
                    }
                }

                for (const measure of measures) {
                    var sample = JSON.parse(JSON.stringify(this.resultSet[0]));
                    sample["@MeasureDimension"]["description"] = measure["description"];
                    sampleSet.push(sample);
                }

                return this.replaceWithDummy(null, null, sampleSet, false);

            } catch (error) {
                console.error("Unable to fetch sample set: ", error);
            }
        }

        // Function for getting data from the model bound to the widget
        async prepareMessages(prompt) {
            try {
                let messageArray = [];

                const regex_quote = new RegExp("\"", "g");
                const regex_newline = new RegExp("\\n", "g");

                // Managing conversation history to maintain session
                // The first message contains dataset in JSON format and instructions to ChatGPT
                var instructions = "You are my laconic python developer. Refer to below JSON format of json_data from SAP Analytics Cloud. Only answer compact pyodide python code <code> to determine the answer to further questions. I will myself pass it to exec(<code>, {'json_data', json.loads(json_data)}).\n\nHere, json_data looks like " + JSON.stringify(this.sampleSet).slice(0, -1) + ", ...]" + "\n\nThe <code> should store the final result in variable 'output' as a descriptive string understandable to business users.";
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
                this.resultSet = await this.fetchResultSet();
                this.sampleSet = await this.fetchSampleSet();
            }
        }

        // Extract ChatGPT code from ChatGPT response
        extractChatGPTCode(codeChatGPT) {
            const regex_python = /```python([\s\S]*?)```/g;
            const regex_ticks = /```([\s\S]*?)```/g;
            if (codeChatGPT.match(regex_python)) {
                codeChatGPT = codeChatGPT.match(regex_python)[0].slice(9, -3).trim();
            } else if (codeChatGPT.match(regex_ticks)) {
                codeChatGPT = codeChatGPT.match(regex_ticks)[0].slice(3, -3).trim();
            }
            return codeChatGPT;
        }

        // Function to process failed query
        dispose() {

        }

        // Main function
        async post(apiKey, endpoint, prompt) {
            try {
                // Prepare result set and sample set
                await this.prepareDataSet();
                console.log(["resultSet", this.resultSet]);
                console.log(["sampleSet", this.sampleSet]);

                // Prepare messages for ChatGPT
                const messageArray = await this.prepareMessages(prompt);
                console.log(["messageArray", messageArray]);

                // API call to ChatGPT
                const {
                    response
                } = await ajaxCall(
                    apiKey,
                    `${url}/${endpoint}`,
                    messageArray
                );
                const codeChatGPT = this.extractChatGPTCode(response.choices[0].message.content);
                console.log(["codeChatGPT", codeChatGPT]);

                // Constant code for debugging
                // const codeChatGPT = this.extractChatGPTCode(`output = {item['Vendor']['description']: 0 for item in json_data if item['@MeasureDimension']['description'] == 'Order Qty'}\nfor item in json_data:\n    if item['@MeasureDimension']['description'] == 'Order Qty':\n        output[item['Vendor']['description']] += int(item['@MeasureDimension']['rawValue'])\noutput = ', '.join([f'{k}: {v}' for k, v in output.items()])`);

                // Execte python code in pyodide
                await this.runPythonCode(codeChatGPT);

                // Get output from pyodide environment
                const codeOutput = this.pyodide.globals.get("output");
                console.log(["codeOutput", codeOutput]);

                return codeOutput;
            } catch (error) {
                console.error("Your query could not be processed. Please try to reformulate your question.", error);
                return "Your query could not be processed. Please try to reformulate your question";
            }
        }
    }
    customElements.define("chatgpt-pyodide-widget", MainWebComponent);
})();
