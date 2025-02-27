import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import {IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';

import type {Subscription} from 'getsentry/types';
import OnDemandBudgetEditModal from 'getsentry/views/onDemandBudgets/onDemandBudgetEditModal';

interface EditOnDemandButtonProps {
  organization: Organization;
  subscription: Subscription;
}

export function openOnDemandBudgetEditModal({
  organization,
  subscription,
}: EditOnDemandButtonProps) {
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
    }
  );
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
