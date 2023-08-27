var ajaxCall = (key, url, messages) => {
  return new Promise((resolve, reject) => {
    $.ajax({
      url: url,
      type: "POST",
      dataType: "json",
      data: JSON.stringify({
        model: "gpt-3.5-turbo-0613",
        messages: messages,
        max_tokens: 1024,
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

      function trimResultSet(obj) {
        for (const key in obj) {
          if (key !== "description" && key !== "rawValue") {
            delete obj[key];
            }
          }
        }

      let resultSet;
      try {
        resultSet = await this.dataBindings.getDataBinding("myDataBinding").getDataSource().getResultSet();
        }
        catch (error) {
          console.error('Error in Data Binding:', error);
          }

      for (const obj of resultSet) {
          for (const key in obj) {
              if (typeof obj[key] === 'object') {
                  trimResultSet(obj[key]);
              }
          }
      }
      
      const messageArray = [];
      const regex_quote = new RegExp("\"", "g");
      const regex_newline = new RegExp("\\n", "g");

      var instructions = "Read the below data in JSON format:\n\n" + resultSet + "\n\nAnswer any further questions in one sentence.";
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
      
      console.log(["messages", messageArray]);

      const { response } = await ajaxCall(
        apiKey,
        `${url}/${endpoint}`,
        messageArray
      );
      console.log(response);
      return response.choices[0].message.content;
    }
  }
  customElements.define("chatgpt-databindings-widget", MainWebComponent);
})();
