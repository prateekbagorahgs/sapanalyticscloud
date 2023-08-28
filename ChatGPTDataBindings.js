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
        temperature: 0.5,
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
    async post(apiKey, endpoint, prompt) {

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
          let resultSet;
          resultSet = await this.dataBindings.getDataBinding("myDataBinding").getDataSource().getResultSet();
          console.log(["resultSet 1", resultSet]);
          
          // Remove unnecessary properties from dimensions and measures to reduce dataset size
          for (const obj of resultSet) {
              for (const key in obj) {
                  if (typeof obj[key] === 'object') {
                      trimResultSet(obj[key]);
                  }
              }
          }
          resultSet = JSON.stringify(resultSet);
          console.log(["resultSet 2", resultSet]);
          
          let messageArray = [];
          console.log(["messageArray empty", messageArray]);
          
          const regex_quote = new RegExp("\"", "g");
          const regex_newline = new RegExp("\\n", "g");
    
          // Managing conversation history to maintain session
          // The first message contains dataset in JSON format and instructions to ChatGPT
          var instructions = "Read the below data in JSON format from SAP Analytics Cloud.\n\n" + resultSet + "\n\nAnswer further questions within this context in one sentence.";
          instructions = instructions.replace(regex_quote, "\\\"");
          var firstMessage = '{"role": "system", "content": "' + instructions + '"}';
          const messageObject = JSON.parse(firstMessage.replace(regex_newline, "\\\\n"));
          console.log(["messageObject", messageObject]);
          
          messageArray.push(messageObject);
          console.log(["messageArray 1", messageArray]);
          
          for (const promptString of prompt) {
            try {
              const messageObject = JSON.parse(promptString.replace(regex_newline, "\\\\n"));
              messageArray.push(messageObject);
              } catch (error) {
              console.error('Error parsing Prompt JSON:', error);
              }
            }
          console.log(["messageArray 2", messageArray]);
          return messageArray;

          } catch (error) {
          console.error('Error in Data Binding:', error);
          }
        }

      // Getting data from the model bound to the widget
      const messageArray = await fetchResultSet.call(this);
      console.log("messageArray 3", messageArray);

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
  customElements.define("chatgpt-databindings-widget", MainWebComponent);
})();
