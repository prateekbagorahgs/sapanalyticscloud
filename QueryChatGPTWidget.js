var resultSet;

var ajaxCall = (prompt) => {
  return new Promise((resolve, reject) => {
    const staticResponse = {
      choices: [{ text: "This is a static response for testing." }],
    };
    resolve({ response: staticResponse, status: 200 });
  });
};

(function () {
  const template = document.createElement("template");
  template.innerHTML = `
		<style>
		</style>
		<div id="root" style="width: 100%; height: 100%;">
		</div>
		`;
  class MainWebComponent extends HTMLElement {
    async post(prompt) {
      const { response } = await ajaxCall(
        prompt
      );
	debugger;
	console.log(["JS Response", response.choices[0].text]);
	console.log(["Data Bindings", this.dataBindings.getDataBinding("myDataBinding").getDataSource().getResultSet()[2]]);
	return response.choices[0].text;
    }
  }
  customElements.define("query-chatgpt-widget", MainWebComponent);
})();
