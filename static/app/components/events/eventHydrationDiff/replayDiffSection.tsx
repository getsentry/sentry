import {lazy} from 'react';
import ReactLazyLoad from 'react-lazyload';
import styled from '@emotion/styled';

import NegativeSpaceContainer from 'sentry/components/container/negativeSpaceContainer';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {REPLAY_LOADING_HEIGHT} from 'sentry/components/events/eventReplay/constants';
import LazyLoad from 'sentry/components/lazyLoad';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import useOrganization from 'sentry/utils/useOrganization';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {SectionDivider} from 'sentry/views/issueDetails/streamline/foldSection';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

interface Props {
  event: Event;
  group: Group | undefined;
  replayId: string;
}

const ReplayDiffContent = lazy(() => import('./replayDiffContent'));

export function ReplayDiffSection({event, group, replayId}: Props) {
  const organization = useOrganization();

  return (
    <ErrorBoundary mini>
      <ReactLazyLoad debounce={50} height={448} offset={0} once>
        <LazyLoad
          event={event}
          group={group}
          orgSlug={organization.slug}
          replaySlug={replayId}
          LazyComponent={ReplayDiffContent}
          loadingFallback={
            <InterimSection
              type={SectionKey.HYDRATION_DIFF}
              title={t('Hydration Error Diff')}
            >
              <StyledNegativeSpaceContainer data-test-id="replay-diff-loading-placeholder">
                <LoadingIndicator />
              </StyledNegativeSpaceContainer>
            </InterimSection>
          }
        />
      </ReactLazyLoad>
      {/* We have to manually add a section divider since LazyLoad puts the section in a wrapper */}
      <SectionDivider />
    </ErrorBoundary>
  );
}

export const StyledNegativeSpaceContainer = styled(NegativeSpaceContainer)`
  height: ${REPLAY_LOADING_HEIGHT}px;
  margin-bottom: ${space(2)};
`;
