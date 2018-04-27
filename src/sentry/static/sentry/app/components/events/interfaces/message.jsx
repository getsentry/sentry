import PropTypes from 'prop-types';
import React from 'react';

import EventDataSection from 'app/components/events/eventDataSection';
import SentryTypes from 'app/proptypes';
import utils from 'app/utils';
import {t} from 'app/locale';

class MessageInterface extends React.Component {
  static propTypes = {
    group: SentryTypes.Group.isRequired,
    event: SentryTypes.Event.isRequired,
    type: PropTypes.string.isRequired,
    data: PropTypes.object.isRequired,
  };

  render() {
    let data = this.props.data;
    return (
      <EventDataSection
        group={this.props.group}
        event={this.props.event}
        type="message"
        title={t('Message')}
      >
        <pre
          className="plain"
          dangerouslySetInnerHTML={{
            __html: utils.nl2br(utils.escape(data.formatted || data.message)),
          }}
        />
        {data.params &&
          !data.formatted && (
            <div>
              <h5>{t('Params')}</h5>
              <pre className="plain">{JSON.stringify(data.params, null, 2)}</pre>
            </div>
          )}
      </EventDataSection>
    );
  }
}

export default MessageInterface;
