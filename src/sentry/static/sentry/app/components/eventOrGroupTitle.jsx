import React, {PropTypes} from 'react';
import {Metadata} from '../proptypes';

const EventOrGroupTitle = React.createClass({
  propTypes: {
    data: PropTypes.shape({
      type: PropTypes.oneOf(['error', 'csp', 'default']).isRequired,
      title: PropTypes.string,
      metadata: Metadata.isRequired,
      culprit: PropTypes.string
    })
  },

  render() {
    let {data} = this.props;
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

    if (subtitle) {
      return (
        <span>
          <span style={{marginRight: 10}}>{title}</span>
          <em>{subtitle}</em><br />
        </span>
      );
    }
    return <span>{title}</span>;
  }
});

export default EventOrGroupTitle;
