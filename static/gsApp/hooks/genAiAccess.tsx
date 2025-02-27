import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {getRegionDataFromOrganization} from 'sentry/utils/regions';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';

import {BillingType, type Subscription} from 'getsentry/types';

export function useGenAiConsentButtonAccess({
  subscription,
}: {
  subscription: Subscription;
}) {
  const user = useUser();
  const organization = useOrganization();

  const regionData = getRegionDataFromOrganization(organization);
  const isUsRegion = regionData?.name === 'us';

  const isTouchCustomer = subscription.type === BillingType.INVOICED;
  const hasMsaUpdated =
    defined(subscription.msaUpdatedForDataConsent) &&
    subscription.msaUpdatedForDataConsent;
  const isTouchCustomerAndNeedsMsaUpdate = isTouchCustomer && !hasMsaUpdated;

  const hasBillingAccess = organization.access.includes('org:billing');

  const fieldsToExport = {
    hasBillingAccess,
    isTouchCustomerAndNeedsMsaUpdate,
    isUsRegion,
    hasMsaUpdated,
    isSuperuser: user?.isSuperuser,
  };

  const conditions = [
    {
      check: !isUsRegion,
      message: t('This feature is not available in your region.'),
    },
    {
      check: isTouchCustomerAndNeedsMsaUpdate,
      message: t(
        'These changes require updates to your account. Please contact your customer success manager to learn more.'
      ),
    },
    {
      check: !hasBillingAccess && !user?.isSuperuser,
      message: t(
        "You don't have access to manage these billing and subscription details."
      ),
    },
  ];

  const matchingCondition = conditions.find(condition => condition.check);

  return {
    ...fieldsToExport,
    isDisabled: !!matchingCondition,
    message: matchingCondition?.message ?? null,
  };
}
