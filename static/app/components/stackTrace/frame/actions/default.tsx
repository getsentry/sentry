import {Fragment} from 'react';

import {Tag} from '@sentry/scraps/badge';

import {useStackTraceFrameContext} from 'sentry/components/stackTrace/stackTraceContext';
import {t} from 'sentry/locale';

import {ChevronAction} from './chevron';
import {HiddenFramesToggleAction} from './hiddenFramesToggle';
import {SourceLinkAction} from './sourceLink';
import {SourceMapsDebuggerAction} from './sourceMapsDebugger';

interface DefaultFrameActionsProps {
  isHovering: boolean;
}

export function DefaultFrameActions({isHovering}: DefaultFrameActionsProps) {
  const {frame} = useStackTraceFrameContext();

  return (
    <Fragment>
      <SourceLinkAction isHovering={isHovering} />
      <SourceMapsDebuggerAction />
      <HiddenFramesToggleAction />
      {frame.inApp ? <Tag variant="info">{t('In App')}</Tag> : null}
      <ChevronAction />
    </Fragment>
  );
}
