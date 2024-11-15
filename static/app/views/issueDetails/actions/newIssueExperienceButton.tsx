import {useCallback} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import DropdownButton from 'sentry/components/dropdownButton';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconLab} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import useMutateUserOptions from 'sentry/utils/useMutateUserOptions';
import useOrganization from 'sentry/utils/useOrganization';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

export function NewIssueExperienceButton() {
  const organization = useOrganization();
  const hasStreamlinedUIFlag = organization.features.includes('issue-details-streamline');
  const hasStreamlinedUI = useHasStreamlinedUI();
  const openForm = useFeedbackForm();
  const {mutate} = useMutateUserOptions();

  const handleToggle = useCallback(() => {
    mutate({['prefersIssueDetailsStreamlinedUI']: !hasStreamlinedUI});
    trackAnalytics('issue_details.streamline_ui_toggle', {
      isEnabled: !hasStreamlinedUI,
      organization: organization,
    });
  }, [mutate, organization, hasStreamlinedUI]);

  if (!hasStreamlinedUIFlag) {
    return null;
  }

  if (!openForm || !hasStreamlinedUI) {
    const label = hasStreamlinedUI
      ? t('Switch to the old issue experience')
      : t('Switch to the new issue experience');

    return (
      <StyledButton
        enabled={hasStreamlinedUI}
        size={hasStreamlinedUI ? 'xs' : 'sm'}
        icon={<IconLab isSolid={hasStreamlinedUI} />}
        title={label}
        aria-label={label}
        onClick={handleToggle}
      />
    );
  }

  return (
    <DropdownMenu
      trigger={triggerProps => (
        <StyledDropdownButton
          {...triggerProps}
          enabled={hasStreamlinedUI}
          size={hasStreamlinedUI ? 'xs' : 'sm'}
          aria-label={t('Switch issue experience')}
        >
          {/* Passing icon as child to avoid extra icon margin */}
          <IconLab isSolid={hasStreamlinedUI} />
        </StyledDropdownButton>
      )}
      items={[
        {
          key: 'switch-to-old-ui',
          label: t('Switch to the old issue experience'),
          onAction: handleToggle,
        },
        {
          key: 'learn-more',
          label: t('Learn more about the new UI'),
          onAction: () => {
            window.open(
              'https://sentry.zendesk.com/hc/en-us/articles/30882241712795',
              '_blank'
            );
          },
        },
        {
          key: 'give-feedback',
          label: t('Give feedback on new UI'),
          hidden: !openForm,
          onAction: () => {
            openForm({
              messagePlaceholder: t(
                'Excluding bribes, what would make you excited to use the new UI?'
              ),
            });
          },
        },
      ]}
      position="bottom-end"
    />
  );
}

const StyledDropdownButton = styled(DropdownButton)<{enabled: boolean}>`
  color: ${p => (p.enabled ? p.theme.button.primary.background : 'inherit')};
  :hover {
    color: ${p => (p.enabled ? p.theme.button.primary.background : 'inherit')};
  }
`;

const StyledButton = styled(Button)<{enabled: boolean}>`
  color: ${p => (p.enabled ? p.theme.button.primary.background : 'inherit')};
  :hover {
    color: ${p => (p.enabled ? p.theme.button.primary.background : 'inherit')};
  }
`;
