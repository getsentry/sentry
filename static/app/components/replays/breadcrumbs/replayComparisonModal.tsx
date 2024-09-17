import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import Alert from 'sentry/components/alert';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import {useGlobalModal} from 'sentry/components/globalModal/useGlobalModal';
import ReplayDiffChooser from 'sentry/components/replays/diff/replayDiffChooser';
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
  // Callbacks set by GlobalModal on-render.
  // We need these to interact with feedback opened while a modal is active.
  const {focusTrap} = useGlobalModal();

  const isSameTimestamp = leftOffsetMs === rightOffsetMs;

  return (
    <OrganizationContext.Provider value={organization}>
      <Header closeButton>
        <ModalHeader>
          <h4>{t('Hydration Error')}</h4>
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
        <Grid>
          <StyledParagraph>
            {tct(
              'This modal helps with debugging hydration errors by diffing the dom before and after the app hydrated. [boldBefore:Before] refers to the html rendered on the server. [boldAfter:After] refers to the html rendered on the client. This feature is actively being developed; please share any questions or feedback to the discussion linked above.',
              {
                boldBefore: <Before />,
                boldAfter: <After />,
              }
            )}
          </StyledParagraph>

          {isSameTimestamp ? (
            <Alert type="warning" showIcon>
              {t(
                "Cannot display diff for this hydration error. Sentry wasn't able to identify the correct event."
              )}
            </Alert>
          ) : (
            <div />
          )}

          <ReplayDiffChooser
            replay={replay}
            leftOffsetMs={leftOffsetMs}
            rightOffsetMs={rightOffsetMs}
          />
        </Grid>
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

const Grid = styled('div')`
  height: 100%;
  display: grid;
  grid-template-rows: max-content max-content 1fr;
  align-items: start;
`;

const StyledParagraph = styled('p')`
  padding-top: ${space(0.5)};
  margin-bottom: ${space(1)};
`;

const Before = styled('strong')`
  color: ${p => p.theme.red300};
`;

const After = styled('strong')`
  color: ${p => p.theme.green300};
`;
