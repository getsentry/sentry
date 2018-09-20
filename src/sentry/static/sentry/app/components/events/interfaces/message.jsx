import PropTypes from 'prop-types';
import React from 'react';

import AnnotatedText from 'app/components/annotatedText';
import EventDataSection from 'app/components/events/eventDataSection';
import SentryTypes from 'app/sentryTypes';
import utils from 'app/utils';
import {t} from 'app/locale';

function renderPre(chunk) {
  // TODO(ja): This causes wrong margins. Fix
  return (
    <pre
      style={{display: 'inline'}}
      className="plain"
      dangerouslySetInnerHTML={{
        __html: utils.nl2br(utils.escape(chunk)),
      }}
    />
  );
}

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

    return (
      <EventDataSection
        group={this.props.group}
        event={this.props.event}
        type="message"
        title={t('Message')}
      >
        {data.formatted ? (
          <AnnotatedText
            text={data.formatted}
            meta={meta.get('formatted')}
            renderWith={renderPre}
          />
        ) : (
          <AnnotatedText
            text={data.message}
            meta={meta.get('message')}
            renderWith={renderPre}
          />
        )}

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
