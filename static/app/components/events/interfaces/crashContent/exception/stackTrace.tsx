import {Panel} from 'sentry/components/panels';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {ExceptionValue, Group, Organization, PlatformType} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {STACK_VIEW} from 'sentry/types/stacktrace';
import {defined} from 'sentry/utils';
import useOrganization from 'sentry/utils/useOrganization';
import EmptyMessage from 'sentry/views/settings/components/emptyMessage';

import StackTraceContent from '../stackTrace/content';
import StacktraceContentV2 from '../stackTrace/contentV2';
import StacktraceContentV3 from '../stackTrace/contentV3';

type Props = {
  data: ExceptionValue['stacktrace'];
  event: Event;
  platform: PlatformType;
  stacktrace: ExceptionValue['stacktrace'];
  chainedException: boolean;
  hasHierarchicalGrouping: boolean;
  groupingCurrentLevel?: Group['metadata']['current_level'];
  stackView?: STACK_VIEW;
  expandFirstFrame?: boolean;
  newestFirst?: boolean;
};

function StackTrace({
  stackView,
  stacktrace,
  chainedException,
  platform,
  newestFirst,
  groupingCurrentLevel,
  hasHierarchicalGrouping,
  data,
  expandFirstFrame,
  event,
}: Props) {
  let organization: Organization | null = null;

  try {
    organization = useOrganization();
  } catch {
    // Organization context may be unavailable for the shared event view. We
    // don't need to do anything if it's unavailable.
  }

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
          title={
            hasHierarchicalGrouping
              ? t('No relevant stack trace has been found!')
              : t('No app only stack trace has been found!')
          }
        />
      </Panel>
    );
  }

  if (!data) {
    return null;
  }

  const includeSystemFrames =
    stackView === STACK_VIEW.FULL ||
    (chainedException && data.frames?.every(frame => !frame.inApp));

  /**
   * Armin, Markus:
   * If all frames are in app, then no frame is in app.
   * This normally does not matter for the UI but when chained exceptions
   * are used this causes weird behavior where one exception appears to not have a stack trace.
   *
   * It is easier to fix the UI logic to show a non-empty stack trace for chained exceptions
   */

  if (!!organization?.features?.includes('native-stack-trace-v2')) {
    return (
      <StacktraceContentV3
        data={data}
        expandFirstFrame={expandFirstFrame}
        includeSystemFrames={includeSystemFrames}
        groupingCurrentLevel={groupingCurrentLevel}
        platform={platform}
        newestFirst={newestFirst}
        event={event}
      />
    );
  }

  if (hasHierarchicalGrouping) {
    return (
      <StacktraceContentV2
        data={data}
        expandFirstFrame={expandFirstFrame}
        includeSystemFrames={includeSystemFrames}
        groupingCurrentLevel={groupingCurrentLevel}
        platform={platform}
        newestFirst={newestFirst}
        event={event}
      />
    );
  }

  return (
    <StackTraceContent
      data={data}
      expandFirstFrame={expandFirstFrame}
      includeSystemFrames={includeSystemFrames}
      platform={platform}
      newestFirst={newestFirst}
      event={event}
    />
  );
}

export default StackTrace;
