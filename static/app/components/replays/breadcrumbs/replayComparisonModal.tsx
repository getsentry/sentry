import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import FeatureBadge from 'sentry/components/badge/featureBadge';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import {useGlobalModal} from 'sentry/components/globalModal/useGlobalModal';
import ReplayDiffChooser from 'sentry/components/replays/diff/replayDiffChooser';
import {tct} from 'sentry/locale';
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
  // Callbacks set by GlobalModal on-render.
  // We need these to interact with feedback opened while a modal is active.
  const {focusTrap} = useGlobalModal();

  return (
    <OrganizationContext.Provider value={organization}>
      <Header closeButton>
        <ModalHeader>
          <h4>
            Hydration Error
            <FeatureBadge type="beta" />
          </h4>
          {focusTrap ? (
            <FeedbackWidgetButton
              optionOverrides={{
                onFormOpen: () => {
                  focusTrap.pause();
                },
                onFormClose: () => {
                  focusTrap.unpause();
                },
              }}
            />
          ) : null}
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
        <ReplayDiffChooser
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
  padding-top: ${p => p.theme.space(0.5)};
  margin-bottom: ${p => p.theme.space(1)};
`;
