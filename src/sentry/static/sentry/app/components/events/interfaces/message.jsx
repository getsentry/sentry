import PropTypes from 'prop-types';
import React from 'react';

import EventDataSection from 'app/components/events/eventDataSection';
import SentryTypes from 'app/sentryTypes';
import {t} from 'app/locale';
import Annotated from 'app/utils/annotated';

class MessageInterface extends React.Component {
  static propTypes = {
    group: SentryTypes.Group.isRequired,
    event: SentryTypes.Event.isRequired,
    data: PropTypes.object.isRequired,
    meta: PropTypes.object.isRequired,
  };

  static defaultProps = {
    meta: {},
  };

  render() {
    let {data, meta} = this.props;
    let annotated = new Annotated(data, meta.data);

    return (
      <EventDataSection
        group={this.props.group}
        event={this.props.event}
        type="message"
        title={t('Message')}
      >
        <pre className="plain">
          {annotated.render('formatted') || annotated.render('message')}
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
