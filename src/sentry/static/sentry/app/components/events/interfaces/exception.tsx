import React from 'react';

import {t} from 'app/locale';
import EventDataSection from 'app/components/events/eventDataSection';
import {isStacktraceNewestFirst} from 'app/components/events/interfaces/stacktrace';
import CrashTitle from 'app/components/events/interfaces/crashHeader/crashTitle';
import CrashActions from 'app/components/events/interfaces/crashHeader/crashActions';
import {STACK_TYPE, STACK_VIEW} from 'app/types/stacktrace';
import CrashContent from 'app/components/events/interfaces/crashContent';
import {Event, ExceptionType} from 'app/types';

const defaultProps = {
  hideGuide: false,
};

type Props = {
  event: Event;
  type: string;
  data: ExceptionType;
  projectId: string;
} & typeof defaultProps;

type State = {
  stackView: STACK_VIEW;
  stackType: STACK_TYPE;
  newestFirst: boolean;
};

class Exception extends React.Component<Props, State> {
  static defaultProps = {
    hideGuide: false,
  };

  state: State = {
    stackView: this.props.data.hasSystemFrames ? STACK_VIEW.APP : STACK_VIEW.FULL,
    newestFirst: isStacktraceNewestFirst(),
    stackType: STACK_TYPE.ORIGINAL,
  };

  handleChange = (newState: Partial<State>) => {
    this.setState(prevState => ({
      ...prevState,
      ...newState,
    }));
  };

  render() {
    const eventHasThreads = !!this.props.event.entries.find(
      entry => entry.type === 'threads'
    );

    // in case there are threads in the event data, we don't render the
    // exception block.  Instead the exception is contained within the
    // thread interface.
    if (eventHasThreads) {
      return null;
    }

    const {projectId, event, data, hideGuide, type} = this.props;
    const {stackView, stackType, newestFirst} = this.state;

    const commonCrashHeaderProps = {
      newestFirst,
      hideGuide,
      onChange: this.handleChange,
    };

    return (
      <EventDataSection
        type={type}
        title={<CrashTitle title={t('Exception')} {...commonCrashHeaderProps} />}
        actions={
          <CrashActions
            stackType={stackType}
            stackView={stackView}
            platform={event.platform}
            exception={data}
            {...commonCrashHeaderProps}
          />
        }
        wrapTitle={false}
      >
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

export default Exception;
