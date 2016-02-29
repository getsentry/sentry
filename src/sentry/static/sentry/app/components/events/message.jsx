import React from 'react';
import EventDataSection from './eventDataSection';
import utils from '../../utils';
import {t} from '../../locale';

const Message = React.createClass({
  propTypes: {
    group: React.PropTypes.object.isRequired,
    event: React.PropTypes.object.isRequired
  },

  render() {
    return (
      <EventDataSection
          group={this.props.group}
          event={this.props.event}
          type="message"
          title={t('Message')}>
        <pre className="plain" dangerouslySetInnerHTML={{
          __html: utils.nl2br(utils.urlize(utils.escape(this.props.event.message)))
        }} />
      </EventDataSection>
    );
  }
});

export default Message;
