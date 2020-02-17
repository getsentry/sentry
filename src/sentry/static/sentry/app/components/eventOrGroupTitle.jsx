import PropTypes from 'prop-types';
import React from 'react';
import {Metadata} from 'app/sentryTypes';
import {getTitle} from 'app/utils/events';

class EventOrGroupTitle extends React.Component {
  static propTypes = {
    data: PropTypes.shape({
      type: PropTypes.oneOf([
        'error',
        'csp',
        'hpkp',
        'expectct',
        'expectstaple',
        'default',
        'transaction',
      ]).isRequired,
      title: PropTypes.string,
      metadata: Metadata.isRequired,
      culprit: PropTypes.string,
    }),
    style: PropTypes.object,
  };

  render() {
    const {title, subtitle} = getTitle(this.props.data);
    if (subtitle) {
      return (
        <span style={this.props.style}>
          <span style={{marginRight: 10}}>{title}</span>
          <em title={subtitle}>{subtitle}</em>
          <br />
        </span>
      );
    }
    return <span style={this.props.style}>{title}</span>;
  }
}

export default EventOrGroupTitle;
