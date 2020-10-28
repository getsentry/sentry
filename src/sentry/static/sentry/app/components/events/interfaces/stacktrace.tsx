import React from 'react';

import ConfigStore from 'app/stores/configStore';
import EventDataSection from 'app/components/events/eventDataSection';
import {t} from 'app/locale';
import CrashTitle from 'app/components/events/interfaces/crashHeader/crashTitle';
import CrashActions from 'app/components/events/interfaces/crashHeader/crashActions';
import CrashContent from 'app/components/events/interfaces/crashContent';
import {Event, Project} from 'app/types';
import {STACK_VIEW} from 'app/types/stacktrace';

export function isStacktraceNewestFirst() {
  const user = ConfigStore.get('user');
  // user may not be authenticated

  if (!user) {
    return true;
  }

  switch (user.options.stacktraceOrder) {
    case 2:
      return true;
    case 1:
      return false;
    case -1:
    default:
      return true;
  }
}

const defaultProps = {
  hideGuide: false,
};

type StackTrace = NonNullable<React.ComponentProps<typeof CrashContent>['stacktrace']>;

type Props = {
  event: Event;
  type: string;
  data: StackTrace;
  projectId: Project['id'];
  hideGuide?: boolean;
} & typeof defaultProps;

type State = {
  stackView: STACK_VIEW;
  newestFirst: boolean;
};

class StacktraceInterface extends React.Component<Props, State> {
  static defaultProps = defaultProps;

  state: State = {
    stackView: this.props.data.hasSystemFrames ? STACK_VIEW.APP : STACK_VIEW.FULL,
    newestFirst: isStacktraceNewestFirst(),
  };

  handleChangeNewestFirst = ({newestFirst}: Pick<State, 'newestFirst'>) => {
    this.setState(prevState => ({...prevState, newestFirst}));
  };

  handleChangeStackView = ({
    stackView,
  }: Parameters<
    NonNullable<React.ComponentProps<typeof CrashActions>['onChange']>
  >[0]) => {
    if (!stackView) {
      return;
    }

    this.setState(prevState => ({...prevState, stackView}));
  };

  render() {
    const {projectId, event, data, hideGuide, type} = this.props;
    const {stackView, newestFirst} = this.state;

    return (
      <EventDataSection
        type={type}
        title={
          <CrashTitle
            title={t('Stacktrace')}
            hideGuide={hideGuide}
            newestFirst={newestFirst}
            onChange={this.handleChangeNewestFirst}
          />
        }
        actions={
          <CrashActions
            stackView={stackView}
            platform={event.platform}
            stacktrace={data}
            onChange={this.handleChangeStackView}
          />
        }
        wrapTitle={false}
      >
        <CrashContent
          projectId={projectId}
          event={event}
          stackView={stackView}
          newestFirst={newestFirst}
          stacktrace={data}
        />
      </EventDataSection>
    );
  }
}

export default StacktraceInterface;
