import PropTypes from 'prop-types';
import React from 'react';

import {t} from 'app/locale';
import EventDataSection from 'app/components/events/eventDataSection';
import SentryTypes from 'app/sentryTypes';
import {isStacktraceNewestFirst} from 'app/components/events/interfaces/stacktrace';
import CrashHeader from 'app/components/events/interfaces/crashHeader';
import CrashContent from 'app/components/events/interfaces/crashContent';

class ExceptionInterface extends React.Component {
  static propTypes = {
    event: SentryTypes.Event.isRequired,
    type: PropTypes.string.isRequired,
    data: PropTypes.object.isRequired,
    projectId: PropTypes.string.isRequired,
    hideGuide: PropTypes.bool,
  };

  static defaultProps = {
    hideGuide: false,
  };

  constructor(...args) {
    super(...args);
    this.state = {
      stackView: this.props.data.hasSystemFrames ? 'app' : 'full',
      newestFirst: isStacktraceNewestFirst(),
      stackType: 'original',
    };
  }

  eventHasThreads = () => !!this.props.event.entries.find(x => x.type === 'threads');

  render() {
    const {projectId, event, data, hideGuide, type} = this.props;
    const {stackView, stackType, newestFirst} = this.state;

    // in case there are threads in the event data, we don't render the
    // exception block.  Instead the exception is contained within the
    // thread interface.
    if (this.eventHasThreads()) {
      return null;
    }

    const title = (
      <CrashHeader
        title={t('Exception')}
        platform={event.platform}
        exception={data}
        stackView={stackView}
        newestFirst={newestFirst}
        stackType={stackType}
        hideGuide={hideGuide}
        onChange={newState => {
          this.setState(newState);
        }}
      />
    );

    return (
      <EventDataSection event={event} type={type} title={title} wrapTitle={false}>
        <CrashContent
          projectId={projectId}
          event={event}
          stackType={stackType}
          stackView={stackView}
          newestFirst={newestFirst}
          exception={data}
        />
      </EventDataSection>
    );
  }
}

export default ExceptionInterface;
