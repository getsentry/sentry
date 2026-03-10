import {Fragment} from 'react';

import {Tag} from '@sentry/scraps/badge';
import {Tooltip} from '@sentry/scraps/tooltip';

import {useStackTraceFrameContext} from 'sentry/components/stackTrace/stackTraceContext';
import {IconRefresh} from 'sentry/icons';
import {t, tn} from 'sentry/locale';

import {ChevronAction} from './chevron';
import {HiddenFramesToggleAction} from './hiddenFramesToggle';
import {SourceLinkAction} from './sourceLink';
import {SourceMapsDebuggerAction} from './sourceMapsDebugger';

interface DefaultFrameActionsProps {
  isHovering: boolean;
}

export function DefaultFrameActions({isHovering}: DefaultFrameActionsProps) {
  const {frame, timesRepeated} = useStackTraceFrameContext();

  return (
    <Fragment>
      <SourceLinkAction isHovering={isHovering} />
      <SourceMapsDebuggerAction />
      <HiddenFramesToggleAction />
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
      <ChevronAction />
    </Fragment>
  );
}
