import {Fragment} from 'react';

import {Tag} from '@sentry/scraps/badge';

import {ChevronAction} from 'sentry/components/stackTrace/frame/actions/chevron';
import {HiddenFramesToggleAction} from 'sentry/components/stackTrace/frame/actions/hiddenFramesToggle';
import {IssueSourceLinkAction} from 'sentry/components/stackTrace/issueStackTrace/issueSourceLinkAction';
import {IssueSourceMapsDebuggerAction} from 'sentry/components/stackTrace/issueStackTrace/issueSourceMapsDebuggerAction';
import {
  useStackTraceContext,
  useStackTraceFrameContext,
} from 'sentry/components/stackTrace/stackTraceContext';
import {t} from 'sentry/locale';

import {GroupingFrameMarker} from './groupingFrameMarker';

interface NativeIssueFrameActionsProps {
  isHovering: boolean;
}

export function NativeIssueFrameActions({isHovering}: NativeIssueFrameActionsProps) {
  const {hasAnyExpandableFrames} = useStackTraceContext();
  const {frame, hiddenFrameCount, isUsedForGrouping} = useStackTraceFrameContext();

  return (
    <Fragment>
      <IssueSourceLinkAction isHovering={isHovering} />
      <IssueSourceMapsDebuggerAction />
      {hiddenFrameCount ? <HiddenFramesToggleAction /> : null}
      {isUsedForGrouping ? <GroupingFrameMarker /> : null}
      {frame.inApp ? <Tag variant="info">{t('In App')}</Tag> : null}
      {hasAnyExpandableFrames ? <ChevronAction /> : null}
    </Fragment>
  );
}
