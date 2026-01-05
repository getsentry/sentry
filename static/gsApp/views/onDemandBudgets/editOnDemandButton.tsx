import {css} from '@emotion/react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import {tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Theme} from 'sentry/utils/theme';

import type {Subscription} from 'getsentry/types';
import {displayBudgetName, hasBillingAccess, supportsPayg} from 'getsentry/utils/billing';
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
        modalCss: theme ? modalCss(theme) : undefined,
      }
    );
    return;
  }

  addErrorMessage(
    tct("You don't have permission to edit [budgetTerm] budgets.", {
      budgetTerm: displayBudgetName(subscription.planDetails),
    })
  );
}

const modalCss = (theme: Theme) => css`
  @media (min-width: ${theme.breakpoints.md}) {
    width: 1000px;
  }
`;
