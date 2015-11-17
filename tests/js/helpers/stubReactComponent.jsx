// Inspired by TimothyRHuertas
// https://gist.github.com/TimothyRHuertas/d7d06313c5411fe242bb

let React = require('react');
let divFactory = React.createFactory('div');
let originalCreateElement = React.createElement;

export default function(stubber, stubbedComponents) {
  stubber.stub(React, 'createElement', function(component, props) {
    props = props || {};
    if (stubbedComponents.indexOf(component) === -1) {
      return originalCreateElement.apply(React, arguments);
    } else {
      let componentFactory = React.createFactory(component);
      let displayName = componentFactory(props).type.displayName;

      if (displayName) {
        if (props.className) {
          props.className = props.className + ' ' + displayName;
        } else {
          props.className = displayName;
        }
      }

      return divFactory(props);
    }
  });
}