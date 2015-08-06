// Inspired by TimothyRHuertas
// https://gist.github.com/TimothyRHuertas/d7d06313c5411fe242bb

var React = require("react");
var divFactory = React.createFactory("div");
var originalCreateElement = React.createElement;

export default function(stubber, stubbedComponents) {
  stubber.stub(React, "createElement", function(component, props) {
    if (stubbedComponents.indexOf(component) === -1) {
      return originalCreateElement.apply(React, arguments);
    } else {
      var componentFactory = React.createFactory(component);
      var displayName = componentFactory().type.displayName;

      if (displayName) {
        if (props.className) {
          props.className = props.className + " " + displayName;
        } else {
          props.className = displayName;
        }
      }

      return divFactory(props);
    }
  });
}