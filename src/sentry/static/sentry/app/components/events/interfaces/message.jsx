import PropTypes from 'prop-types';
import React from 'react';

import KeyValueList from 'app/components/events/interfaces/keyValueList/keyValueList';
import Annotated from 'app/components/events/meta/annotated';
import EventDataSection from 'app/components/events/eventDataSection';
import SentryTypes from 'app/sentryTypes';
import {t} from 'app/locale';
import {objectIsEmpty} from 'app/utils';

class MessageInterface extends React.Component {
  static propTypes = {
    event: SentryTypes.Event.isRequired,
    data: PropTypes.object.isRequired,
  };

  renderParams() {
    let {params} = this.props.data;
    if (objectIsEmpty(params)) {
      return null;
    }

    // NB: Always render params, regardless of whether they appear in the
    // formatted string due to structured logging frameworks, like Serilog. They
    // only format some parameters into the formatted string, but we want to
    // display all of them.

    if (Array.isArray(params)) {
      params = params.map((value, i) => [`#${i}`, value]);
    }

    return <KeyValueList data={params} isSorted={false} isContextData />;
  }

  render() {
    const {data, event} = this.props;

    return (
      <EventDataSection event={event} type="message" title={t('Message')}>
        <pre className="plain">
          <Annotated object={data} objectKey="formatted" />
        </pre>
        {this.renderParams()}
      </EventDataSection>
    );
  }
}

export default MessageInterface;
