import PropTypes from 'prop-types';
import React from 'react';

import Annotated from 'app/components/events/meta/annotated';
import EventDataSection from 'app/components/events/eventDataSection';
import SentryTypes from 'app/sentryTypes';
import {t} from 'app/locale';

class MessageInterface extends React.Component {
  static propTypes = {
    group: SentryTypes.Group.isRequired,
    event: SentryTypes.Event.isRequired,
    data: PropTypes.object.isRequired,
  };

  render() {
    let {data, group, event} = this.props;

    return (
      <EventDataSection group={group} event={event} type="message" title={t('Message')}>
        <pre className="plain">
          <Annotated object={data} prop="formatted">
            {formatted => formatted || <Annotated object={data} prop="message" />}
          </Annotated>
        </pre>

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
