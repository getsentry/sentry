import {Fragment} from 'react';

import {Tag} from '@sentry/scraps/badge';
import {Tooltip} from '@sentry/scraps/tooltip';

import {ChevronAction} from 'sentry/components/stackTrace/frame/actions/chevron';
import {HiddenFramesToggleAction} from 'sentry/components/stackTrace/frame/actions/hiddenFramesToggle';
import {
  useStackTraceContext,
  useStackTraceFrameContext,
} from 'sentry/components/stackTrace/stackTraceContext';
import {IconRefresh} from 'sentry/icons';
import {t, tn} from 'sentry/locale';

import {AnrFrameAction} from './anrFrameAction';
import {IssueSourceLinkAction} from './issueSourceLinkAction';
import {IssueSourceMapsDebuggerAction} from './issueSourceMapsDebuggerAction';

interface IssueFrameActionsProps {
  isHovering: boolean;
  // These actions require an actual event (e.g. an error) in context, so they
  // won't work when rendering for e.g. a span.
  includeIssueOnlyActions?: boolean;
}

export function IssueFrameActions({
  isHovering,
  includeIssueOnlyActions = true,
}: IssueFrameActionsProps) {
  const {hasAnyExpandableFrames} = useStackTraceContext();
  const {frame, hiddenFrameCount, timesRepeated} = useStackTraceFrameContext();

  return (
    <Fragment>
      <IssueSourceLinkAction isHovering={isHovering} />
      {includeIssueOnlyActions ? <IssueSourceMapsDebuggerAction /> : null}
      {includeIssueOnlyActions ? <AnrFrameAction /> : null}
      {hiddenFrameCount ? <HiddenFramesToggleAction /> : null}
      {timesRepeated > 0 ? (
        <Tooltip
          title={tn('Frame repeated %s time', 'Frame repeated %s times', timesRepeated)}
          skipWrapper
        >
          <Tag
            icon={<IconRefresh size="xs" />}
            variant="muted"
            aria-label={tn(
              'Frame repeated %s time',
              'Frame repeated %s times',
              timesRepeated
            )}
          >
            {timesRepeated}
          </Tag>
        </Tooltip>
      ) : null}
      {frame.inApp ? <Tag variant="info">{t('In App')}</Tag> : null}
      {hasAnyExpandableFrames ? <ChevronAction /> : null}
    </Fragment>
  );
}
