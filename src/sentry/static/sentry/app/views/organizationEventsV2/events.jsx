import React from 'react';
import SentryTypes from 'app/sentryTypes';

export default class Events extends React.Component {
  static propTypes = {
    view: SentryTypes.EventView.isRequired,
  };
  render() {
    return this.props.view.name;
  }
}
