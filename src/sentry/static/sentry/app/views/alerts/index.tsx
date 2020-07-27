import React from 'react';

type Props = {};

class AlertsContainer extends React.Component<Props> {
  render() {
    return <React.Fragment>{this.props.children}</React.Fragment>;
  }
}

export default AlertsContainer;
