import {css} from '@emotion/react';
import {IconFix} from '@sentry/icons/fix';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {useModal} from '@sentry/scraps/modal';

import {
  frameCanShowSourceMapDebugger,
  prepareSourceMapDebuggerFrameInformation,
  useSourceMapDebugQuery,
} from 'sentry/components/events/interfaces/crashContent/exception/useSourceMapDebuggerData';
import {SourceMapsDebuggerModal} from 'sentry/components/events/interfaces/sourceMapsDebuggerModal';
import {
  useStackTraceContext,
  useStackTraceFrameContext,
} from 'sentry/components/stackTrace/stackTraceContext';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';

export function IssueSourceMapsDebuggerAction() {
  const {openModal} = useModal();

  const {frame, event, frameIndex} = useStackTraceFrameContext();
  const {exceptionIndex, hideSourceMapDebugger, project} = useStackTraceContext();
  const organization = useOrganization({allowNull: true});

  // The debug response is indexed by exception, so standalone stack traces
  // (no exceptionIndex) can never show the button.
  const canShowButton =
    exceptionIndex !== undefined &&
    !hideSourceMapDebugger &&
    frameCanShowSourceMapDebugger(frame);

  // Every frame shares the same per-event query, so one eligible frame is
  // enough to fetch the data for all of them.
  const {data: sourceMapDebuggerData} = useSourceMapDebugQuery(
    project?.slug ?? '',
    event.id,
    event.sdk?.name ?? null,
    canShowButton
  );
  const debuggerFrame =
    exceptionIndex === undefined
      ? undefined
      : sourceMapDebuggerData?.exceptions[exceptionIndex]?.frames[frameIndex];
  const frameSourceResolutionResults =
    debuggerFrame && sourceMapDebuggerData
      ? prepareSourceMapDebuggerFrameInformation(
          sourceMapDebuggerData,
          debuggerFrame,
          event,
          project?.platform
        )
      : undefined;

  if (
    !canShowButton ||
    !frameSourceResolutionResults ||
    frameSourceResolutionResults.frameIsResolved
  ) {
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
      variant="secondary"
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
      <Flex as="span" display="inline-flex" align="center" gap="xs">
        <IconFix size="xs" />
        <span>{t('Unminify Code')}</span>
      </Flex>
    </Button>
  );
}
