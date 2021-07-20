import {Panel} from 'app/components/panels';
import {IconWarning} from 'app/icons';
import {t} from 'app/locale';
import {ExceptionValue, Group, PlatformType} from 'app/types';
import {Event} from 'app/types/event';
import {STACK_VIEW} from 'app/types/stacktrace';
import {defined} from 'app/utils';
import EmptyMessage from 'app/views/settings/components/emptyMessage';

import StacktraceContent from './stacktraceContent';
import StacktraceContentV2 from './stacktraceContentV2';

type Props = {
  data: ExceptionValue['stacktrace'];
  event: Event;
  platform: PlatformType;
  stacktrace: ExceptionValue['stacktrace'];
  chainedException: boolean;
  hasGroupingTreeUI: boolean;
  groupingCurrentLevel?: Group['metadata']['current_level'];
  stackView?: STACK_VIEW;
  expandFirstFrame?: boolean;
  newestFirst?: boolean;
};

const ExceptionStacktraceContent = ({
  stackView,
  stacktrace,
  chainedException,
  platform,
  newestFirst,
  groupingCurrentLevel,
  hasGroupingTreeUI,
  data,
  expandFirstFrame,
  event,
}: Props) => {
  if (!defined(stacktrace)) {
    return null;
  }

  if (
    stackView === STACK_VIEW.APP &&
    (stacktrace.frames ?? []).filter(frame => frame.inApp).length === 0 &&
    !chainedException
  ) {
    return (
      <Panel dashedBorder>
        <EmptyMessage
          icon={<IconWarning size="xs" />}
          title={t('No app only stack trace has been found!')}
        />
      </Panel>
    );
  }

  if (!data) {
    return null;
  }

  /**
   * Armin, Markus:
   * If all frames are in app, then no frame is in app.
   * This normally does not matter for the UI but when chained exceptions
   * are used this causes weird behavior where one exception appears to not have a stack trace.
   *
   * It is easier to fix the UI logic to show a non-empty stack trace for chained exceptions
   */

  if (hasGroupingTreeUI) {
    return (
      <StacktraceContentV2
        data={data}
        expandFirstFrame={expandFirstFrame}
        includeSystemFrames={stackView === STACK_VIEW.FULL}
        groupingCurrentLevel={groupingCurrentLevel}
        platform={platform}
        newestFirst={newestFirst}
        event={event}
      />
    );
  }

  return (
    <StacktraceContent
      data={data}
      expandFirstFrame={expandFirstFrame}
      includeSystemFrames={
        stackView === STACK_VIEW.FULL ||
        (chainedException && (stacktrace.frames ?? []).every(frame => !frame.inApp))
      }
      platform={platform}
      newestFirst={newestFirst}
      event={event}
    />
  );
};

export default ExceptionStacktraceContent;
