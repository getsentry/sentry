import {useState} from 'react';

import {IconLightning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';

import StartTrialButton from 'getsentry/components/startTrialButton';
import {useProductBillingMetadata} from 'getsentry/hooks/useProductBillingMetadata';
import {AddOnCategory, type ProductTrial, type Subscription} from 'getsentry/types';
import {checkIsAddOn, getBilledCategory} from 'getsentry/utils/billing';
import {getPlanCategoryName} from 'getsentry/utils/dataCategory';
import {
  Cta,
  SeerCta,
} from 'getsentry/views/subscriptionPage/usageOverview/components/cta/base';

function ProductTrialCta({
  organization,
  subscription,
  selectedProduct,
  showBottomBorder,
}: {
  organization: Organization;
  selectedProduct: DataCategory | AddOnCategory;
  showBottomBorder: boolean;
  subscription: Subscription;
}) {
  const [trialButtonBusy, setTrialButtonBusy] = useState(false);
  const {
    billedCategory,
    billedCategoryInfo,
    isAddOn,
    addOnInfo,
    potentialProductTrial,
    productName,
  } = useProductBillingMetadata(subscription, selectedProduct);
  if (
    !billedCategory ||
    (isAddOn && !addOnInfo) ||
    !billedCategoryInfo?.canProductTrial ||
    !potentialProductTrial
  ) {
    return null;
  }

  // if (selectedProduct === AddOnCategory.SEER) {
  //   return (
  //     <SeerCta
  //       action={
  //         <StartTrialButton
  //           size="md"
  //           icon={<IconLightning />}
  //           organization={organization}
  //           source="usage-overview"
  //           requestData={{
  //             productTrial: {
  //               category: potentialProductTrial.category,
  //               reasonCode: potentialProductTrial.reasonCode,
  //             },
  //           }}
  //           priority="primary"
  //           handleClick={() => setTrialButtonBusy(true)}
  //           onTrialStarted={() => setTrialButtonBusy(true)}
  //           onTrialFailed={() => setTrialButtonBusy(false)}
  //           busy={trialButtonBusy}
  //           disabled={trialButtonBusy}
  //         >
  //           {t('Start 14 day free trial')}
  //         </StartTrialButton>
  //       }
  //       footerText={t(
  //         "Trial begins immediately. You won't be billed unless you upgrade after the trial ends."
  //       )}
  //     />
  //   );
  // }

  const productTrialCtaContent = billedCategoryInfo?.panelCtaContent?.productTrial;

  return (
    <Cta
      title={
        productTrialCtaContent?.title ??
        tct('Try unlimited [productName], free for 14 days', {productName})
      }
      subtitle={
        productTrialCtaContent?.subtitle ??
        t('Trial starts immediately, no usage will be billed during this period.')
      }
      action={
        <StartTrialButton
          size="md"
          icon={<IconLightning />}
          organization={organization}
          source="usage-overview"
          requestData={{
            productTrial: {
              category: potentialProductTrial.category,
              reasonCode: potentialProductTrial.reasonCode,
            },
          }}
          priority="primary"
          handleClick={() => setTrialButtonBusy(true)}
          onTrialStarted={() => setTrialButtonBusy(true)}
          onTrialFailed={() => setTrialButtonBusy(false)}
          busy={trialButtonBusy}
          disabled={trialButtonBusy}
        >
          {t('Activate free trial')}
        </StartTrialButton>
      }
      findOutMoreHref="https://docs.sentry.io/pricing/#product-trials"
      hasContentBelow={showBottomBorder}
    />
  );
}

export default ProductTrialCta;
