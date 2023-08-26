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
	//console.log(response.choices[0].text);
	console.log(this.dataBindings);
	return response.choices[0].text;
    }
  }
  customElements.define("query-chatgpt-widget", MainWebComponent);
})();
