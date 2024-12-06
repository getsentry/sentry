import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import Alert from 'sentry/components/alert';
import AnalyticsArea from 'sentry/components/analyticsArea';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import {useGlobalModal} from 'sentry/components/globalModal/useGlobalModal';
import ExternalLink from 'sentry/components/links/externalLink';
import LearnMoreButton from 'sentry/components/replays/diff/learnMoreButton';
import ReplayDiffChooser from 'sentry/components/replays/diff/replayDiffChooser';
import {Tooltip} from 'sentry/components/tooltip';
import {IconInfo} from 'sentry/icons/iconInfo';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type ReplayReader from 'sentry/utils/replays/replayReader';
import {OrganizationContext} from 'sentry/views/organizationContext';

interface Props extends ModalRenderProps {
  leftOffsetMs: number;
  organization: Organization;
  replay: ReplayReader;
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
      <AnalyticsArea name="hydration-error-modal">
        <Header closeButton>
          <ModalHeader>
            <Title>
              {t('Hydration Error')}
              <Tooltip
                isHoverable
                title={tct(
                  'This modal helps with debugging hydration errors by diffing the DOM before and after the app hydrated. [boldBefore:Before] refers to the HTML rendered on the server. [boldAfter:After] refers to the HTML rendered on the client. Read more about [link:resolving hydration errors].',
                  {
                    boldBefore: <Before />,
                    boldAfter: <After />,
                    link: (
                      <ExternalLink href="https://sentry.io/answers/hydration-error-nextjs/" />
                    ),
                  }
                )}
              >
                <IconInfo />
              </Tooltip>
            </Title>
            <LearnMoreButton />
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
          {isSameTimestamp ? (
            <Alert type="warning" showIcon>
              {t(
                "Cannot display diff for this hydration error. Sentry wasn't able to identify the correct event."
              )}
            </Alert>
          ) : null}

          <ReplayDiffChooser
            replay={replay}
            leftOffsetMs={leftOffsetMs}
            rightOffsetMs={rightOffsetMs}
          />
        </Body>
      </AnalyticsArea>
    </OrganizationContext.Provider>
  );
}

const ModalHeader = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-direction: row;
`;

const Title = styled('h4')`
  display: flex;
  gap: ${space(1)};
`;

export const Before = styled('span')`
  color: ${p => p.theme.red300};
  font-weight: bold;
`;

export const After = styled('span')`
  color: ${p => p.theme.green300};
  font-weight: bold;
`;
