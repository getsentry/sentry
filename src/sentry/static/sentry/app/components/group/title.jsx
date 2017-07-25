import React, {PropTypes} from 'react';

const GroupTitle = React.createClass({
  propTypes: {
    data: PropTypes.shape({
      type: PropTypes.oneOf(['error', 'csp', 'default']).isRequired,
      title: PropTypes.string,
      metadata: PropTypes.shape({
        directive: PropTypes.string,
        type: PropTypes.string,
        title: PropTypes.string,
        uri: PropTypes.string
      }).isRequired,
      culprit: PropTypes.string
    })
  },

  render() {
    let {data} = this.props;
    let {metadata, title: _title, type, culprit} = data;
    let title = _title;
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

export default GroupTitle;
