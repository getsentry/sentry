import React from 'react';
import PropTypes from 'prop-types';

import {Event, Group} from 'app/types';
import {Metadata} from 'app/sentryTypes';
import {getTitle} from 'app/utils/events';

type Props = {
  data: Event | Group;
  style: React.CSSProperties;
};

class EventOrGroupTitle extends React.Component<Props> {
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
    const {title, subtitle} = getTitle(this.props.data as Event);

    return subtitle ? (
      <span style={this.props.style}>
        <span>{title}</span>
        <Spacer />
        <em title={subtitle}>{subtitle}</em>
        <br />
      </span>
    ) : (
      <span style={this.props.style}>{title}</span>
    );
  }
}

export default EventOrGroupTitle;

/**
 * &nbsp; is used instead of margin/padding to split title and subtitle
 * into 2 separate text nodes on the HTML AST. This allows the
 * title to be highlighted without spilling over to the subtitle.
 */
const Spacer = () => <span style={{display: 'inline-block', width: 10}}>&nbsp;</span>;
