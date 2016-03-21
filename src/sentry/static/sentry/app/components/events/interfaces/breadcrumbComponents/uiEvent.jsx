import React from 'react';

import Classifier from './classifier';

const UiEventComponent = React.createClass({
  propTypes: {
    data: React.PropTypes.object.isRequired,
  },

  render() {
    let data = this.props.data;
    return (
      <p>
        <strong>{data.event || 'UI Event'}</strong> on <code>{data.target || 'undefined target'}</code>
        <Classifier value={data.classifier} title="%s call"/>
      </p>
    );
  }
});

export default UiEventComponent;
