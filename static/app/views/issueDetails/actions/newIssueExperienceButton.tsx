import {useCallback, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import DropdownButton from 'sentry/components/dropdownButton';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {TourAction, TourGuide} from 'sentry/components/tours/components';
import {useMutateAssistant} from 'sentry/components/tours/useAssistant';
import {IconLab} from 'sentry/icons';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import useMutateUserOptions from 'sentry/utils/useMutateUserOptions';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {
  ISSUE_DETAILS_TOUR_GUIDE_KEY,
  useIssueDetailsTour,
} from 'sentry/views/issueDetails/issueDetailsTour';
import {
  IssueDetailsTourModal,
  IssueDetailsTourModalCss,
} from 'sentry/views/issueDetails/issueDetailsTourModal';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

export function NewIssueExperienceButton() {
  const user = useUser();
  const organization = useOrganization();
  const isSuperUser = isActiveSuperuser();

  const {
    dispatch: tourDispatch,
    currentStepId,
    isAvailable: isTourAvailable,
    isRegistered: isTourRegistered,
    isCompleted: isTourCompleted,
  } = useIssueDetailsTour();
  const {mutate: mutateAssistant} = useMutateAssistant();

  // The promotional modal should only appear if:
  //  - The tour is available to this user
  //  - All the steps have been registered
  //  - The tour has not been completed
  //  - The tour is not currently active
  const isPromoVisible =
    isTourAvailable && isTourRegistered && !isTourCompleted && currentStepId === null;

  // XXX: We use a ref to track the previous state of tour completion
  // since we only show the banner when the tour goes from incomplete to complete
  const isTourCompletedRef = useRef(isTourCompleted);
  const [isReminderVisible, setIsReminderVisible] = useState(false);
  useEffect(() => {
    // If the tour becomes completed, and started off incomplete, show the reminder.
    if (isTourCompleted && !isTourCompletedRef.current) {
      setIsReminderVisible(true);
    }
    isTourCompletedRef.current = isTourCompleted;
  }, [isTourCompleted]);

  const hasStreamlinedUIFlag = organization.features.includes('issue-details-streamline');
  const hasEnforceStreamlinedUIFlag = organization.features.includes(
    'issue-details-streamline-enforce'
  );
  const hasNewUIOnly = organization.streamlineOnly;

  const hasStreamlinedUI = useHasStreamlinedUI();
  const openForm = useFeedbackForm();
  const {mutate: mutateUserOptions} = useMutateUserOptions();

  const handleToggle = useCallback(() => {
    mutateUserOptions({['prefersIssueDetailsStreamlinedUI']: !hasStreamlinedUI});
    trackAnalytics('issue_details.streamline_ui_toggle', {
      isEnabled: !hasStreamlinedUI,
      organization,
    });
  }, [mutateUserOptions, organization, hasStreamlinedUI]);

  useEffect(() => {
    if (isPromoVisible) {
      openModal(
        props => (
          <IssueDetailsTourModal
            {...props}
            handleDismissTour={() => {
              mutateAssistant({guide: ISSUE_DETAILS_TOUR_GUIDE_KEY, status: 'dismissed'});
              tourDispatch({type: 'SET_COMPLETION', isCompleted: true});
              props.closeModal();
            }}
            handleStartTour={() => {
              props.closeModal();
              tourDispatch({type: 'START_TOUR'});
            }}
          />
        ),
        {modalCss: IssueDetailsTourModalCss}
      );
    }
  }, [isPromoVisible, tourDispatch, mutateAssistant]);

  // We hide the toggle if the org...
  if (
    // doesn't have the 'opt-in' flag,
    !hasStreamlinedUIFlag ||
    // has the 'remove opt-out' flag,
    hasEnforceStreamlinedUIFlag ||
    // has access to only the updated experience through the experiment
    hasNewUIOnly
  ) {
    return null;
  }

  if (!openForm || !hasStreamlinedUI) {
    const label = hasStreamlinedUI
      ? t('Switch to the old issue experience')
      : t('Switch to the new issue experience');
    const text = hasStreamlinedUI ? null : t('Try New UI');

    return (
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
        onClick={handleToggle}
      >
        {text}
      </ToggleButton>
    );
  }

  const items = [
    {
      key: 'switch-to-old-ui',
      label: t('Switch to the old issue experience'),
      onAction: handleToggle,
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
          tags: {
            ['feedback.source']: 'streamlined_issue_details',
            ['feedback.owner']: 'issues',
          },
        });
      },
    },
  ];

  if (isTourAvailable && isTourRegistered) {
    items.unshift({
      key: 'start-tour',
      label: t('Take a tour'),
      onAction: () => tourDispatch({type: 'START_TOUR'}),
    });
  }

  if (isSuperUser && isTourCompleted) {
    items.push({
      key: 'reset-tour-modal',
      label: t('Reset tour modal (Superuser only)'),
      onAction: () => {
        mutateAssistant({guide: ISSUE_DETAILS_TOUR_GUIDE_KEY, status: 'restart'});
      },
    });
  }

  return (
    <TourGuide
      title={t('Come back anytime')}
      description={t('Click here to take the tour or share feedback with the team.')}
      actions={
        <TourAction size="xs" onClick={() => setIsReminderVisible(false)}>
          {t('Got it')}
        </TourAction>
      }
      isOpen={isReminderVisible}
    >
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
        items={items}
        position="bottom-end"
      />
    </TourGuide>
  );
}

const StyledDropdownButton = styled(DropdownButton)<{enabled: boolean}>`
  color: ${p => (p.enabled ? p.theme.button.primary.background : 'inherit')};
  :hover {
    color: ${p => (p.enabled ? p.theme.button.primary.background : 'inherit')};
  }
`;

const ToggleButton = styled(Button)<{enabled: boolean}>`
  color: ${p => (p.enabled ? p.theme.button.primary.background : p.theme.white)};
  background: ${p =>
    p.enabled ? 'inherit' : `linear-gradient(90deg, #3468D8, #248574)`};
  :hover {
    color: ${p => (p.enabled ? p.theme.button.primary.background : p.theme.white)};
  }
`;
