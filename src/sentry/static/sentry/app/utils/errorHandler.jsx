import React from 'react';
import RouteError from '../views/routeError';

export default function errorHandler(Component) {
  const originalRender = Component.prototype.render;

  Component.prototype.render = function tryRender() {
    try {
      return originalRender.apply(this, arguments);
    } catch (err) {
      console.error(err);
      return <RouteError error={err} component={this} />;
    }
  };

  return Component;
}
