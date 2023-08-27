var ajaxCall = (key, url, prompt, size) => {
  return new Promise((resolve, reject) => {
    $.ajax({
      url: url,
      type: "POST",
      dataType: "json",
      data: JSON.stringify({
        prompt: prompt,
	size: size,
        n: 1,
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
    async post(apiKey, endpoint, prompt, size) {

	// Remove unnecessary properties from dimensions and measures to reduce dataset size
	function trimResultSet(obj) {
	for (const key in obj) {
	  if (key !== "description" && key !== "rawValue") {
	    delete obj[key];
	    }
	  }
	}

      	// Getting data from the model bound to the widget
	let resultSet;
	try {
	resultSet = await this.dataBindings.getDataBinding("myDataBinding").getDataSource().getResultSet();
	}
	catch (error) {
	  console.error('Error in Data Binding:', error);
	  }

      	// Remove unnecessary properties from dimensions and measures to reduce dataset size
	for (const obj of resultSet) {
	  for (const key in obj) {
	      if (typeof obj[key] === 'object') {
		  trimResultSet(obj[key]);
	      }
	  }
	}
	resultSet = JSON.stringify(resultSet);
	console.log(["trimmedResultSet", resultSet]);
	const regex_quote = new RegExp("\"", "g");
	const regex_newline = new RegExp("\\n", "g");
	  
	var instructions = "Read the below data in JSON format:\n\n" + resultSet + "\n\n" + prompt;
	instructions = instructions.replace(regex_quote, "\\\"");
	instructions = instructions.replace(regex_newline, "\\\\n");
	console.log(["instructions", instructions]);

	const { response } = await ajaxCall(
	apiKey,
	`${url}/${endpoint}`,
	instructions,
	size
	);
	console.log(response);
	return response.data.data[0].url;
    }
  }
  customElements.define("chatgpt-visualizations-widget", MainWebComponent);
})();
