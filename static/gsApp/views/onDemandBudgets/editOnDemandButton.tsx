import {css} from '@emotion/react';

import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Theme} from 'sentry/utils/theme';

import type {Subscription} from 'getsentry/types';
import {hasBillingAccess, hasNewBillingUI, supportsPayg} from 'getsentry/utils/billing';
import OnDemandBudgetEditModal from 'getsentry/views/onDemandBudgets/onDemandBudgetEditModal';

interface EditOnDemandButtonProps {
  organization: Organization;
  subscription: Subscription;
  theme?: Theme;
}

export function openOnDemandBudgetEditModal({
  organization,
  subscription,
  theme,
}: EditOnDemandButtonProps) {
  const isNewBillingUI = hasNewBillingUI(organization);
  const hasBillingPerms = hasBillingAccess(organization);
  const canUsePayg = supportsPayg(subscription);

  if (hasBillingPerms && canUsePayg) {
    openModal(
      modalProps => (
        <OnDemandBudgetEditModal
          {...modalProps}
          subscription={subscription}
          organization={organization}
        />
      ),
      {
        closeEvents: 'escape-key',
        modalCss: theme && isNewBillingUI ? modalCss(theme) : undefined,
      }
    );
  }
}

export function EditOnDemandButton(props: EditOnDemandButtonProps) {
  return (
    <Button
      priority="primary"
      onClick={() => {
        openOnDemandBudgetEditModal(props);
      }}
      size="sm"
      icon={<IconEdit size="xs" />}
    >
      {t('Edit')}
    </Button>
  );
}

const modalCss = (theme: Theme) => css`
  @media (min-width: ${theme.breakpoints.md}) {
    width: 1000px;
  }
`;
