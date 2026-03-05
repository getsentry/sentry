import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';

import {openModal} from 'sentry/actionCreators/modal';
import {SourceMapsDebuggerModal} from 'sentry/components/events/interfaces/sourceMapsDebuggerModal';
import {
  useStackTraceContext,
  useStackTraceFrameContext,
} from 'sentry/components/stackTrace/stackTraceContext';
import {IconFix} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';

import {VALID_SOURCE_MAP_DEBUGGER_FILE_ENDINGS} from './utils';

export function SourceMapsDebuggerAction() {
  const {frame, event, frameIndex} = useStackTraceFrameContext();
  const {frameSourceMapDebuggerData, hideSourceMapDebugger} = useStackTraceContext();
  const organization = useOrganization({allowNull: true});

  const frameSourceResolutionResults = frameSourceMapDebuggerData?.[frameIndex];
  const frameHasValidFileEndingForSourceMapDebugger =
    VALID_SOURCE_MAP_DEBUGGER_FILE_ENDINGS.some(
      ending =>
        (frame.absPath ?? '').endsWith(ending) || (frame.filename ?? '').endsWith(ending)
    );
  const shouldShowSourceMapDebuggerButton =
    !frame.context?.length &&
    !hideSourceMapDebugger &&
    frame.inApp &&
    frameHasValidFileEndingForSourceMapDebugger &&
    !!frameSourceResolutionResults &&
    !frameSourceResolutionResults.frameIsResolved;

  if (!shouldShowSourceMapDebuggerButton || !frameSourceResolutionResults) {
    return null;
  }

  const sourceMapDebuggerAnalytics = {
    organization,
    project_id: event.projectID,
    event_id: event.id,
    event_platform: event.platform,
    sdk_name: event.sdk?.name,
    sdk_version: event.sdk?.version,
  };

  return (
    <Button
      size="zero"
      priority="default"
      onClick={mouseEvent => {
        mouseEvent.stopPropagation();
        trackAnalytics(
          'source_map_debug_blue_thunder.modal_opened',
          sourceMapDebuggerAnalytics
        );

        openModal(
          modalProps => (
            <SourceMapsDebuggerModal
              analyticsParams={sourceMapDebuggerAnalytics}
              sourceResolutionResults={frameSourceResolutionResults}
              organization={organization ?? undefined}
              projectId={event.projectID}
              {...modalProps}
            />
          ),
          {
            modalCss: css`
              max-width: 800px;
              width: 100%;
            `,
            onClose: () => {
              trackAnalytics(
                'source_map_debug_blue_thunder.modal_closed',
                sourceMapDebuggerAnalytics
              );
            },
          }
        );
      }}
    >
      <UnminifyActionContent>
        <IconFix size="xs" />
        <span>{t('Unminify Code')}</span>
      </UnminifyActionContent>
    </Button>
  );
}

const UnminifyActionContent = styled('span')`
  display: inline-flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
`;
