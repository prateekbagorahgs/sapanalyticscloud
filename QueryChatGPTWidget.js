(function() {
	const template = document.createElement("template");

	template.innerHTML = `
      <div id="root" style="width: 100%; height: 100%;">
      </div>
    `;
	
	class MainWebComponent extends HTMLElement {
		constructor() {
      super();
      console.log("Hello!")
			console.log('dataBinding:', dataBinding);
			}
  }
  customElements.define("query_chatgpt-widget", MainWebComponent);
})();
