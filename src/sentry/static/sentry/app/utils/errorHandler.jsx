import React from 'react';
import RouteError from '../views/routeError';

export default function errorHandler(Component) {
  const originalRender = Component.prototype.render;
  Component.prototype.render = function() {
    try {
      return originalRender.apply(this, arguments);
    } catch (err) {
      return <RouteError error={err} component={this} />;
    }
  };

  const originalComponentWillMount = Component.prototype.componentWillMount;
  Component.prototype.componentWillMount = function() {
    try {
      return originalComponentWillMount.apply(this, arguments);
    } catch (err) {
      return <RouteError error={err} component={this} />;
    }
  };

  return Component;
}
