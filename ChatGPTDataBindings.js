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

      const resultSet = this.dataBindings.getDataBinding("myDataBinding").getDataSource().getResultSet();
      console.log(resultSet);
      
      const regex = new RegExp("\\n", "g");
      const messageArray = [];

      for (const promptString of prompt) {
      try {
        const messageObject = JSON.parse(promptString.replace(regex, "\\\\n"));
        messageArray.push(messageObject);
        } catch (error) {
        console.error('Error parsing Prompt JSON:', error);
        }
      }
      
      console.log(["messages",messageArray]);

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
