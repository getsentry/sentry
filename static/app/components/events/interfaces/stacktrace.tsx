import * as React from 'react';

import EventDataSection from 'app/components/events/eventDataSection';
import CrashContent from 'app/components/events/interfaces/crashContent';
import CrashActions from 'app/components/events/interfaces/crashHeader/crashActions';
import CrashTitle from 'app/components/events/interfaces/crashHeader/crashTitle';
import {t} from 'app/locale';
import ConfigStore from 'app/stores/configStore';
import {Group, Project} from 'app/types';
import {Event} from 'app/types/event';
import {STACK_TYPE, STACK_VIEW} from 'app/types/stacktrace';

import NoStackTraceMessage from './noStackTraceMessage';

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

type CrashContentProps = React.ComponentProps<typeof CrashContent>;

type Props = Pick<CrashContentProps, 'groupingCurrentLevel' | 'hasGroupingTreeUI'> & {
  event: Event;
  type: string;
  data: NonNullable<CrashContentProps['stacktrace']>;
  projectId: Project['id'];
  hasGroupingTreeUI: boolean;
  groupingCurrentLevel?: Group['metadata']['current_level'];
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
    const {
      projectId,
      event,
      data,
      hideGuide,
      type,
      groupingCurrentLevel,
      hasGroupingTreeUI,
    } = this.props;
    const {stackView, newestFirst} = this.state;

    const stackTraceNotFound = !(data.frames ?? []).length;

    return (
      <EventDataSection
        type={type}
        title={
          <CrashTitle
            title={t('Stack Trace')}
            hideGuide={hideGuide}
            newestFirst={newestFirst}
            onChange={!stackTraceNotFound ? this.handleChangeNewestFirst : undefined}
          />
        }
        actions={
          !stackTraceNotFound && (
            <CrashActions
              stackView={stackView}
              platform={event.platform}
              stacktrace={data}
              hasGroupingTreeUI={hasGroupingTreeUI}
              onChange={this.handleChangeStackView}
            />
          )
        }
        wrapTitle={false}
      >
        {stackTraceNotFound ? (
          <NoStackTraceMessage />
        ) : (
          <CrashContent
            projectId={projectId}
            event={event}
            stackView={stackView}
            newestFirst={newestFirst}
            stacktrace={data}
            stackType={STACK_TYPE.ORIGINAL}
            groupingCurrentLevel={groupingCurrentLevel}
            hasGroupingTreeUI={hasGroupingTreeUI}
          />
        )}
      </EventDataSection>
    );
  }
}

export default StacktraceInterface;
