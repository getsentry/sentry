import {useCallback} from 'react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {Button} from 'sentry/components/button';
import DropdownButton from 'sentry/components/dropdownButton';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconLab} from 'sentry/icons';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import useMutateUserOptions from 'sentry/utils/useMutateUserOptions';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

export function NewIssueExperienceButton() {
  const user = useUser();
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
      <ToggleButtonWrapper>
        <ToggleButton
          enabled={hasStreamlinedUI}
          size={hasStreamlinedUI ? 'xs' : 'sm'}
          icon={
            defined(user?.options?.prefersIssueDetailsStreamlinedUI) ? (
              <IconLab isSolid={hasStreamlinedUI} />
            ) : (
              <motion.div
                style={{height: 14}}
                animate={{
                  rotate: [null, 6, -6, 12, -12, 6, -6, 0],
                }}
                transition={{
                  duration: 1,
                  delay: 1,
                  repeatDelay: 3,
                  repeat: 3,
                }}
              >
                <IconLab isSolid={hasStreamlinedUI} />
              </motion.div>
            )
          }
          title={label}
          aria-label={label}
          borderless={!hasStreamlinedUI}
          onClick={handleToggle}
        >
          <ToggleBorder />
        </ToggleButton>
      </ToggleButtonWrapper>
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

const ToggleButtonWrapper = styled('div')`
  overflow: hidden;
  margin: 0 -1px;
  border-radius: 7px;
`;

const ToggleButton = styled(Button)<{enabled: boolean}>`
  position: relative;
  color: ${p => (p.enabled ? p.theme.button.primary.background : 'inherit')};
  :hover {
    color: ${p => (p.enabled ? p.theme.button.primary.background : 'inherit')};
  }
  &:after {
    position: absolute;
    content: '';
    inset: 0;
    background: ${p => p.theme.background};
    border-radius: ${p => p.theme.borderRadius};
  }
  span {
    z-index: 1;
    margin: 0;
  }
`;

const ToggleBorder = styled('div')`
  @keyframes rotating {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
  position: absolute;
  content: '';
  z-index: -1;
  width: 46px;
  height: 46px;
  border-radius: 7px;
  background: ${p => p.theme.badge.beta.background};
  animation: rotating 10s linear infinite;
`;
