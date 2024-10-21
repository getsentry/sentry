import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {IconLab} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import {useLocation} from 'sentry/utils/useLocation';
import useMutateUserOptions from 'sentry/utils/useMutateUserOptions';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

export function NewIssueExperienceButton() {
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();
  const hasStreamlinedUIFlag = organization.features.includes('issue-details-streamline');
  const hasStreamlinedUI = useHasStreamlinedUI();
  const openForm = useFeedbackForm();
  const {mutate} = useMutateUserOptions();

  if (!hasStreamlinedUIFlag) {
    return null;
  }

  const feedbackButton = openForm ? (
    <Button
      size="sm"
      aria-label={t('Give feedback on new UI')}
      onClick={() =>
        openForm({
          messagePlaceholder: t('How can we make this new UI work for you?'),
          tags: {
            ['feedback.source']: 'issue_details_streamline_ui',
            ['feedback.owner']: 'issues',
          },
        })
      }
    >
      {t('Give Feedback')}
    </Button>
  ) : null;

  const label = hasStreamlinedUI
    ? t('Switch to the old issue experience')
    : t('Switch to the new issue experience');

  return (
    <ButtonBar merged>
      <StyledButton
        enabled={hasStreamlinedUI}
        size="sm"
        icon={<IconLab isSolid={hasStreamlinedUI} />}
        title={label}
        aria-label={label}
        onClick={() => {
          mutate({['prefersIssueDetailsStreamlinedUI']: !hasStreamlinedUI});
          trackAnalytics('issue_details.streamline_ui_toggle', {
            isEnabled: !hasStreamlinedUI,
            organization: organization,
          });
          navigate({
            ...location,
            query: {...location.query, streamline: hasStreamlinedUI ? '0' : '1'},
          });
        }}
      />
      {hasStreamlinedUI && feedbackButton}
    </ButtonBar>
  );
}

const StyledButton = styled(Button)<{enabled: boolean}>`
  color: ${p => (p.enabled ? p.theme.button.primary.background : 'inherit')};
  :hover {
    color: ${p => (p.enabled ? p.theme.button.primary.background : 'inherit')};
  }
`;
