import React from 'react';
import RouteError from '../views/routeError';

const InvalidStateError = function(message) {
  this.name = 'InvalidStateError';
  this.message = message || '';
};

InvalidStateError.prototype = Error.prototype;

export default function errorHandler(Component) {
  const originalRender = Component.prototype.render;
  Component.prototype.render = function() {
    try {
      if (this.state === null) {
        throw new InvalidStateError('State was not defined when rendering component.');
      }
      return originalRender.apply(this, arguments);
    } catch (err) {
      /*eslint no-console:0*/
      console.log('Failed on render with', err);
      return <RouteError error={err} component={this} />;
    }
  };
  return Component;
}
