import styled from '@emotion/styled';

import {NegativeSpaceContainer} from 'sentry/components/container/negativeSpaceContainer';
import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {REPLAY_LOADING_HEIGHT} from 'sentry/components/events/eventReplay/constants';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {ArchivedReplayAlert} from 'sentry/components/replays/alerts/archivedReplayAlert';
import {MissingReplayAlert} from 'sentry/components/replays/alerts/missingReplayAlert';
import {ReplayRequestsThrottledAlert} from 'sentry/components/replays/alerts/replayRequestsThrottledAlert';
import {OpenReplayComparisonButton} from 'sentry/components/replays/breadcrumbs/openReplayComparisonButton';
import {DiffCompareContextProvider} from 'sentry/components/replays/diff/diffCompareContext';
import {ReplaySliderDiff} from 'sentry/components/replays/diff/replaySliderDiff';
import {ReplayLoadingState} from 'sentry/components/replays/player/replayLoadingState';
import {ReplayGroupContextProvider} from 'sentry/components/replays/replayGroupContext';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {getReplayDiffOffsetsFromEvent} from 'sentry/utils/replays/getDiffTimestamps';
import {useLoadReplayReader} from 'sentry/utils/replays/hooks/useLoadReplayReader';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {FoldSection} from 'sentry/views/issueDetails/streamline/foldSection';

interface Props {
  event: Event;
  group: Group | undefined;
  orgSlug: string;
  replaySlug: string;
}

export default function ReplayDiffContent({event, group, orgSlug, replaySlug}: Props) {
  const organization = useOrganization();
  const readerResult = useLoadReplayReader({
    orgSlug: organization.slug,
    replaySlug,
    clipWindow: undefined,
  });

  const sectionProps = {
    sectionKey: SectionKey.HYDRATION_DIFF,
    title: t('Hydration Error Diff'),
  };

  return (
    <ReplayLoadingState
      readerResult={readerResult}
      renderArchived={() => (
        <FoldSection {...sectionProps}>
          <ArchivedReplayAlert
            message={t('The replay for this event has been deleted.')}
          />
        </FoldSection>
      )}
      renderLoading={() => (
        <FoldSection {...sectionProps}>
          <StyledNegativeSpaceContainer data-test-id="replay-diff-loading-placeholder">
            <LoadingIndicator />
          </StyledNegativeSpaceContainer>
        </FoldSection>
      )}
      renderError={() => (
        <FoldSection {...sectionProps}>
          <MissingReplayAlert orgSlug={orgSlug} />
        </FoldSection>
      )}
      renderThrottled={() => (
        <FoldSection {...sectionProps}>
          <ReplayRequestsThrottledAlert />
        </FoldSection>
      )}
      renderMissing={() => (
        <FoldSection {...sectionProps}>
          <MissingReplayAlert orgSlug={orgSlug} />
        </FoldSection>
      )}
    >
      {({replay}) => {
        const {frameOrEvent, leftOffsetMs, rightOffsetMs} = getReplayDiffOffsetsFromEvent(
          replay,
          event
        );
        return (
          <FoldSection
            {...sectionProps}
            actions={
              <OpenReplayComparisonButton
                frameOrEvent={frameOrEvent}
                initialLeftOffsetMs={leftOffsetMs}
                initialRightOffsetMs={rightOffsetMs}
                key="open-modal-button"
                replay={replay}
                size="xs"
                surface="issue-details" // TODO: refactor once this component is used in more surfaces
              >
                {t('Open Diff Viewer')}
              </OpenReplayComparisonButton>
            }
          >
            <ErrorBoundary mini>
              <ReplayGroupContextProvider groupId={group?.id} eventId={event.id}>
                <DiffCompareContextProvider
                  replay={replay}
                  frameOrEvent={frameOrEvent}
                  initialLeftOffsetMs={leftOffsetMs}
                  initialRightOffsetMs={rightOffsetMs}
                >
                  <ReplaySliderDiff minHeight="355px" />
                </DiffCompareContextProvider>
              </ReplayGroupContextProvider>
            </ErrorBoundary>
          </FoldSection>
        );
      }}
    </ReplayLoadingState>
  );
}

const StyledNegativeSpaceContainer = styled(NegativeSpaceContainer)`
  height: ${REPLAY_LOADING_HEIGHT}px;
  margin-bottom: ${p => p.theme.space.xl};
`;
