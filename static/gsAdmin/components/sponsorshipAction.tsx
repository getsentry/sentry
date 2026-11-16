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

const REMOVE_SPONSORSHIP = 'remove';

const SPONSORED_TYPE_CHOICES: Array<[string, string]> = [
  ['education', 'Education'],
  ['open_source', 'Open source'],
  ['non_profit', 'Non-profit'],
  ['employee', 'Employee'],
  ['friends_and_family', 'Friends and family'],
];

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
      onConfirm?.({
        sponsoredType: sponsoredType === REMOVE_SPONSORSHIP ? null : sponsoredType,
      });
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

  const choices: Array<[string, string]> = subscription.isSponsored
    ? [[REMOVE_SPONSORSHIP, 'None (remove sponsorship)'], ...SPONSORED_TYPE_CHOICES]
    : SPONSORED_TYPE_CHOICES;

  return (
    <Fragment>
      {subscription.isSponsored && (
        <Alert.Container>
          <Alert variant="info">This account is already sponsored.</Alert>
        </Alert.Container>
      )}
      {sponsoredType === REMOVE_SPONSORSHIP && (
        <Alert.Container>
          <Alert variant="warning">
            Removing the sponsorship takes effect immediately. The account keeps its
            current plan and billing period, but the sponsorship's extra quotas, along
            with any other custom reserved volumes or pay-as-you-go budget, go back to the
            plan's defaults.
          </Alert>
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
        choices={choices}
      />
    </Fragment>
  );
}
