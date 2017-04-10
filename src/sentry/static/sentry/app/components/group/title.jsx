import React from 'react';

const GroupTitle = React.createClass({
  propTypes: {
    data: React.PropTypes.object.isRequired,
  },

  render() {
    let data = this.props.data;
    let metadata = data.metadata;
    let title = data.title;
    let subtitle = null;
    if (data.type == 'error') {
      title = metadata.type;
      subtitle = data.culprit;
    } else if (data.type == 'csp') {
      title = metadata.directive;
      subtitle = metadata.uri;
    } else if (data.type == 'default') {
      title = metadata.title;
    }
    if (subtitle) {
      return (
        <span>
          <span style={{marginRight: 10}}>{title}</span>
          <em>{subtitle}</em><br/>
        </span>
      );
    }
    return <span>{title}</span>;
  },
});

export default GroupTitle;
