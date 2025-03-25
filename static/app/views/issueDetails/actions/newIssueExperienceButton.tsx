import {useCallback, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import DropdownButton from 'sentry/components/dropdownButton';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {TourAction, TourGuide} from 'sentry/components/tours/components';
import {useMutateAssistant} from 'sentry/components/tours/useAssistant';
import {IconLab} from 'sentry/icons';
import {t} from 'sentry/locale';
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
import {useIssueDetailsTourAvailable} from 'sentry/views/issueDetails/useIssueDetailsTourAvailable';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

export function NewIssueExperienceButton() {
  const organization = useOrganization();
  const isSuperUser = isActiveSuperuser();
  const {
    dispatch: tourDispatch,
    currentStepId,
    isRegistered: isTourRegistered,
    isCompleted: isTourCompleted,
  } = useIssueDetailsTour();
  const {mutate: mutateAssistant} = useMutateAssistant();

  // XXX: We use a ref to track the previous state of tour completion
  // since we only show the banner when the tour goes from incomplete to complete
  const isTourCompletedRef = useRef(isTourCompleted);
  const [isReminderVisible, setIsReminderVisible] = useState(false);
  useEffect(() => {
    // If the tour becomes completed, and started off incomplete, show the reminder.
    let timeout: NodeJS.Timeout | undefined;
    if (isTourCompleted && !isTourCompletedRef.current) {
      setIsReminderVisible(true);
      // Auto-dismiss after 5 seconds
      timeout = setTimeout(() => {
        setIsReminderVisible(false);
        trackAnalytics('issue_details.tour.reminder', {organization, method: 'timeout'});
      }, 5000);
    }
    isTourCompletedRef.current = isTourCompleted;
    return () => clearTimeout(timeout);
  }, [isTourCompleted, organization]);

  const hasStreamlinedUI = useHasStreamlinedUI();
  const hasStreamlinedUIFlag = organization.features.includes('issue-details-streamline');
  const hasNewUIOnly = Boolean(organization.streamlineOnly);
  const user = useUser();
  const userStreamlinePreference = user?.options?.prefersIssueDetailsStreamlinedUI;

  const openForm = useFeedbackForm();
  const {mutate: mutateUserOptions} = useMutateUserOptions();

  const handleToggle = useCallback(() => {
    mutateUserOptions({['prefersIssueDetailsStreamlinedUI']: !hasStreamlinedUI});
    trackAnalytics('issue_details.streamline_ui_toggle', {
      isEnabled: !hasStreamlinedUI,
      organization,
      enforced_streamline_ui:
        organization.features.includes('issue-details-streamline-enforce') &&
        userStreamlinePreference === null,
    });
  }, [mutateUserOptions, organization, hasStreamlinedUI, userStreamlinePreference]);

  const isTourAvailable = useIssueDetailsTourAvailable();

  // The promotional modal should only appear if:
  //  - The tour is available to this user
  //  - All the steps have been registered
  //  - The tour has not been completed
  //  - The tour is not currently active
  //  - The streamline UI is enabled
  const isPromoVisible =
    isTourAvailable &&
    isTourRegistered &&
    !isTourCompleted &&
    currentStepId === null &&
    hasStreamlinedUI;

  useEffect(() => {
    if (isPromoVisible) {
      openModal(
        props => (
          <IssueDetailsTourModal
            handleDismissTour={() => {
              mutateAssistant({guide: ISSUE_DETAILS_TOUR_GUIDE_KEY, status: 'dismissed'});
              tourDispatch({type: 'SET_COMPLETION', isCompleted: true});
              trackAnalytics('issue_details.tour.skipped', {organization});
              props.closeModal();
            }}
            handleStartTour={() => {
              props.closeModal();
              tourDispatch({type: 'START_TOUR'});
              trackAnalytics('issue_details.tour.started', {
                organization,
                method: 'modal',
              });
            }}
          />
        ),
        {modalCss: IssueDetailsTourModalCss}
      );
    }
  }, [isPromoVisible, tourDispatch, mutateAssistant, organization]);

  if (!hasStreamlinedUI) {
    return (
      <TryNewButton
        icon={<IconLab />}
        size="sm"
        title={t('Switch to the new issue experience')}
        aria-label={t('Switch to the new issue experience')}
        onClick={() => {
          handleToggle();
        }}
      >
        {t('Try New UI')}
      </TryNewButton>
    );
  }

  const items = [
    {
      key: 'take-tour',
      label: t('Take a tour'),
      hidden: !isTourAvailable || !isTourRegistered,
      onAction: () => {
        trackAnalytics('issue_details.tour.started', {organization, method: 'dropdown'});
        tourDispatch({type: 'START_TOUR'});
      },
    },
    {
      key: 'give-feedback',
      label: t('Give feedback on the UI'),
      hidden: !openForm,
      onAction: () => {
        openForm?.({
          messagePlaceholder: t('Tell us what you think about the new UI'),
          tags: {
            ['feedback.source']: 'streamlined_issue_details',
            ['feedback.owner']: 'issues',
          },
        });
      },
    },
    {
      key: 'switch-to-old-ui',
      label: t('Switch to the old issue experience'),
      // Do not show the toggle out of the new UI if any of these are true:
      //  - The user is on the old UI
      //  - The org does not have the opt-in flag
      //  - The org has the new UI only option
      hidden: !hasStreamlinedUI || !hasStreamlinedUIFlag || hasNewUIOnly,
      onAction: handleToggle,
    },
    {
      key: 'reset-tour-modal',
      label: t('Reset tour modal (Superuser only)'),
      hidden: !isSuperUser || !isTourCompleted,
      onAction: () => {
        mutateAssistant({guide: ISSUE_DETAILS_TOUR_GUIDE_KEY, status: 'restart'});
      },
    },
  ];

  if (items.every(item => item.hidden)) {
    return null;
  }

  return (
    <TourGuide
      title={t('Come back anytime')}
      description={t('Click here to take the tour or share feedback with the team.')}
      actions={
        <TourAction
          size="xs"
          onClick={() => {
            trackAnalytics('issue_details.tour.reminder', {
              organization,
              method: 'dismissed',
            });
            setIsReminderVisible(false);
          }}
        >
          {t('Got it')}
        </TourAction>
      }
      isOpen={isReminderVisible}
    >
      <DropdownMenu
        trigger={triggerProps => (
          <StyledDropdownButton
            {...triggerProps}
            size={hasStreamlinedUI ? 'xs' : 'sm'}
            aria-label={t('Manage issue experience')}
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

const StyledDropdownButton = styled(DropdownButton)`
  color: ${p => p.theme.button.primary.background};
  :hover {
    color: ${p => p.theme.button.primary.background};
  }
`;

const TryNewButton = styled(Button)`
  background: linear-gradient(90deg, #3468d8, #248574);
  color: ${p => p.theme.white};
  &:hover,
  &:active,
  &:focus {
    color: ${p => p.theme.white};
  }
`;
