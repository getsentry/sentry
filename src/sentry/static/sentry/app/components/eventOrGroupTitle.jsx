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

    // &nbsp; is used instead of margin/padding to split title and subtitle
    // into 2 separate text nodes on the HTML syntax tree. This allows the
    // title to be highlighted without spilling over to the subtitle. The
    // width of 2 spaces is 10px.
    if (subtitle) {
      return (
        <span style={this.props.style}>
          <span>{title}</span>
          &nbsp;&nbsp;
          <em title={subtitle}>{subtitle}</em>
          <br />
        </span>
      );
    }
    return <span style={this.props.style}>{title}</span>;
  }
}

export default EventOrGroupTitle;
