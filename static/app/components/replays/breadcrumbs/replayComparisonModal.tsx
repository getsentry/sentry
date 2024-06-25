import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import FeatureBadge from 'sentry/components/badge/featureBadge';
import {GithubFeedbackButton} from 'sentry/components/githubFeedbackButton';
import ReplayDiff from 'sentry/components/replays/replayDiff';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type ReplayReader from 'sentry/utils/replays/replayReader';
import {OrganizationContext} from 'sentry/views/organizationContext';

interface Props extends ModalRenderProps {
  leftOffsetMs: number;
  organization: Organization;
  replay: null | ReplayReader;
  rightOffsetMs: number;
}

export default function ReplayComparisonModal({
  Body,
  Header,
  leftOffsetMs,
  organization,
  replay,
  rightOffsetMs,
}: Props) {
  return (
    <OrganizationContext.Provider value={organization}>
      <Header closeButton>
        <ModalHeader>
          <h4>
            Hydration Error
            <FeatureBadge type="beta" />
          </h4>
          <GithubFeedbackButton
            href="https://github.com/getsentry/sentry/discussions/62097"
            label={t('Discussion')}
            title={null}
            analyticsEventKey="replay.details-hydration-discussion-clicked"
            analyticsEventName="Replay Details Hydration Discussion Clicked"
            priority="primary"
          />
        </ModalHeader>
      </Header>
      <Body>
        <StyledParagraph>
          {tct(
            'This modal helps with debugging hydration errors by diffing the dom before and after the app hydrated. [boldBefore:Before Hydration] refers to the html rendered on the server. [boldAfter:After Hydration] refers to the html rendered on the client. This feature is actively being developed; please share any questions or feedback to the discussion linked above.',
            {
              boldBefore: <strong />,
              boldAfter: <strong />,
            }
          )}
        </StyledParagraph>
        <ReplayDiff
          replay={replay}
          leftOffsetMs={leftOffsetMs}
          rightOffsetMs={rightOffsetMs}
        />
      </Body>
    </OrganizationContext.Provider>
  );
}

const ModalHeader = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-direction: row;
`;

const StyledParagraph = styled('p')`
  padding-top: ${space(0.5)};
  margin-bottom: ${space(1)};
`;
