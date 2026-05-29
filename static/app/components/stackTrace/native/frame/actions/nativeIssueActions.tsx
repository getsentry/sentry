import {Fragment} from 'react';

import {Tag} from '@sentry/scraps/badge';
import {Tooltip} from '@sentry/scraps/tooltip';

import {ChevronAction} from 'sentry/components/stackTrace/frame/actions/chevron';
import {HiddenFramesToggleAction} from 'sentry/components/stackTrace/frame/actions/hiddenFramesToggle';
import {IssueSourceLinkAction} from 'sentry/components/stackTrace/issueStackTrace/issueSourceLinkAction';
import {IssueSourceMapsDebuggerAction} from 'sentry/components/stackTrace/issueStackTrace/issueSourceMapsDebuggerAction';
import {
  useStackTraceContext,
  useStackTraceFrameContext,
} from 'sentry/components/stackTrace/stackTraceContext';
import {IconRefresh} from 'sentry/icons';
import {t} from 'sentry/locale';

interface NativeIssueFrameActionsProps {
  isHovering: boolean;
}

export function NativeIssueFrameActions({isHovering}: NativeIssueFrameActionsProps) {
  const {hasAnyExpandableFrames} = useStackTraceContext();
  const {frame, hiddenFrameCount, isUsedForGrouping} = useStackTraceFrameContext();
  const groupingMarkerLabel = t('This frame is repeated in every event of this issue');

  return (
    <Fragment>
      <IssueSourceLinkAction isHovering={isHovering} />
      <IssueSourceMapsDebuggerAction />
      {hiddenFrameCount ? <HiddenFramesToggleAction /> : null}
      {isUsedForGrouping ? (
        <Tooltip title={groupingMarkerLabel} skipWrapper>
          <span aria-label={groupingMarkerLabel}>
            <IconRefresh size="sm" variant="primary" />
          </span>
        </Tooltip>
      ) : null}
      {frame.inApp ? <Tag variant="info">{t('In App')}</Tag> : null}
      {hasAnyExpandableFrames ? <ChevronAction /> : null}
    </Fragment>
  );
}
