import {Fragment, useCallback, useEffect, useState} from 'react';

import {Alert} from '@sentry/scraps/alert';

import {SelectField} from 'sentry/components/forms/fields/selectField';

import type {
  AdminConfirmParams,
  AdminConfirmRenderProps,
} from 'admin/components/adminConfirmationModal';
import type {Subscription} from 'getsentry/types';

type Props = AdminConfirmRenderProps & {
  subscription: Subscription;
};

/**
 * Rendered as part of a openAdminConfirmModal call
 */
export function SponsorshipAction({
  subscription,
  setConfirmCallback,
  disableConfirmButton,
  onConfirm,
}: Props) {
  const [sponsoredType, setSponsoredType] = useState<string | null | undefined>(
    undefined
  );

  const handleConfirm = useCallback(
    (_params: AdminConfirmParams) => {
      const data = {sponsoredType};
      onConfirm?.(data);
    },
    [sponsoredType, onConfirm]
  );

  // Register the confirm callback whenever it changes (sponsoredType updates handleConfirm)
  useEffect(() => {
    setConfirmCallback(handleConfirm);
  }, [setConfirmCallback, handleConfirm]);

  // Disable the confirm button on mount only
  useEffect(() => {
    disableConfirmButton(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (value: string | null) => {
    disableConfirmButton(!value);
    setSponsoredType(value);
  };

  if (!subscription) {
    return null;
  }

  return (
    <Fragment>
      {subscription.isSponsored && (
        <Alert.Container>
          <Alert variant="info">This account is already sponsored.</Alert>
        </Alert.Container>
      )}
      <SelectField
        required
        inline={false}
        stacked
        flexibleControlStateSize
        label="Sponsored Type"
        name="sponsored-type"
        value={sponsoredType}
        onChange={(val: any) => val && handleChange(val)}
        choices={[
          ['education', 'Education'],
          ['open_source', 'Open source'],
          ['non_profit', 'Non-profit'],
          ['employee', 'Employee'],
          ['friends_and_family', 'Friends and family'],
        ]}
      />
    </Fragment>
  );
}
