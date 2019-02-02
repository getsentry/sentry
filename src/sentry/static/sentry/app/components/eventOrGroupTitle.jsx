import PropTypes from 'prop-types';
import React from 'react';
import {Metadata} from 'app/sentryTypes';

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
      ]).isRequired,
      title: PropTypes.string,
      metadata: Metadata.isRequired,
      culprit: PropTypes.string,
    }),
  };

  render() {
    const {data} = this.props;
    const {metadata, type, culprit} = data;
    let {title} = data;
    let subtitle = null;

    if (type == 'error') {
      title = metadata.type;
      subtitle = culprit;
    } else if (type == 'csp') {
      title = metadata.directive;
      subtitle = metadata.uri;
    } else if (type === 'expectct' || type === 'expectstaple' || type === 'hpkp') {
      title = metadata.message;
      subtitle = metadata.origin;
    } else if (type == 'default') {
      title = metadata.title;
    }

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
