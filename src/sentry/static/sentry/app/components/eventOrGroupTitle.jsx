import PropTypes from 'prop-types';
import React from 'react';
import {Metadata} from '../proptypes';

// TODO(billy): hope to refactor this out with styled components
const GRAY = '#625471';

const EventOrGroupTitle = React.createClass({
  propTypes: {
    isResolved: PropTypes.bool,
    data: PropTypes.shape({
      type: PropTypes.oneOf(['error', 'csp', 'default']).isRequired,
      title: PropTypes.string,
      metadata: Metadata.isRequired,
      culprit: PropTypes.string
    })
  },

  render() {
    let {data, isResolved} = this.props;
    let {metadata, title, type, culprit} = data;
    let subtitle = null;

    if (type == 'error') {
      title = metadata.type;
      subtitle = culprit;
    } else if (type == 'csp') {
      title = metadata.directive;
      subtitle = metadata.uri;
    } else if (type == 'default') {
      title = metadata.title;
    }

    let styles = {};

    if (isResolved) {
      styles = {
        ...styles,
        color: GRAY,
        textDecoration: 'line-through'
      };
    }

    if (subtitle) {
      return (
        <span>
          <span style={{...styles, marginRight: 10}}>{title}</span>
          <em style={styles}>{subtitle}</em><br />
        </span>
      );
    }
    return <span style={styles}>{title}</span>;
  }
});

export default EventOrGroupTitle;
