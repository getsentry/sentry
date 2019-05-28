import React from 'react';

import SentryTypes from 'app/sentryTypes';
import TagDistributionMeter from 'app/components/tagDistributionMeter';

export default class Tags extends React.Component {
  static propTypes = {
    view: SentryTypes.EventView.isRequired,
  };

  renderTag(tag) {
    return <TagDistributionMeter key={tag} title={tag} segments={[]} />;
  }

  render() {
    return <div>{this.props.view.tags.map(tag => this.renderTag(tag))}</div>;
  }
}
