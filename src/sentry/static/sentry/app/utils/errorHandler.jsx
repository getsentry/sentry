import React from 'react';
import RouteError from '../views/routeError';

export default function errorHandler(Component) {
  const originalRender = Component.prototype.render;
  Component.prototype.render = function() {
    try {
      return originalRender.apply(this, arguments);
    } catch (err) {
      /*eslint no-console:0*/
      console.log('Failed on render with', err);
      return <RouteError error={err} component={this} />;
    }
  };
  return Component;
}
