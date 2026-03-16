import {Fragment} from 'react';

import {Tag} from '@sentry/scraps/badge';
import {Tooltip} from '@sentry/scraps/tooltip';

import {
  ChevronAction,
  HiddenFramesToggleAction,
} from 'sentry/components/stackTrace/frame/actions';
import {
  useStackTraceContext,
  useStackTraceFrameContext,
} from 'sentry/components/stackTrace/stackTraceContext';
import {IconRefresh} from 'sentry/icons';
import {t, tn} from 'sentry/locale';

import {IssueSourceLinkAction} from './issueSourceLinkAction';
import {IssueSourceMapsDebuggerAction} from './issueSourceMapsDebuggerAction';

interface IssueFrameActionsProps {
  isHovering: boolean;
}

export function IssueFrameActions({isHovering}: IssueFrameActionsProps) {
  const {hasAnyExpandableFrames} = useStackTraceContext();
  const {frame, hiddenFrameCount, timesRepeated} = useStackTraceFrameContext();

  return (
    <Fragment>
      <IssueSourceLinkAction isHovering={isHovering} />
      <IssueSourceMapsDebuggerAction />
      {hiddenFrameCount ? <HiddenFramesToggleAction /> : null}
      {timesRepeated > 0 ? (
        <Tooltip
          title={tn('Frame repeated %s time', 'Frame repeated %s times', timesRepeated)}
          skipWrapper
        >
          <Tag
            icon={<IconRefresh size="xs" />}
            variant="muted"
            data-test-id="core-stacktrace-repeats-tag"
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
