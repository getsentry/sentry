import {Button} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import * as Storybook from 'sentry/stories';
import {useOrganization} from 'sentry/utils/useOrganization';

import {openSeerAutoTopUpModal} from 'getsentry/views/subscriptionPage/seerWallet/autoTopUpModal';
import {openSeerTopUpModal} from 'getsentry/views/subscriptionPage/seerWallet/topUpModal';

export default Storybook.story('Seer top-up modal', story => {
  story('Out of credits', () => {
    const organization = useOrganization();

    return (
      <Stack gap="md" align="start">
        <Text as="p">
          What a billing member sees after clicking "Configure auto reload" in the
          out-of-credits CTA: the balance, then the auto top-up settings from the billing
          page. This one opens with sample wallet data instead of loading yours; Save
          still writes your organization's settings.
        </Text>
        <Button
          onClick={() =>
            openSeerAutoTopUpModal({
              organization,
              balance: 0,
              creditPriceCents: 1,
              autoTopUp: {
                enabled: false,
                thresholdCredits: 500,
                topUpCredits: 1000,
                dailySpendCapCents: 7500,
              },
            })
          }
        >
          Open with sample data
        </Button>
      </Stack>
    );
  });

  story("Your organization's wallet", () => {
    const organization = useOrganization();

    return (
      <Stack gap="md" align="start">
        <Text as="p">
          The modal the CTA opens, loading your organization's Seer wallet. Organizations
          without token-billed Seer get the load error and its retry. Saving changes the
          real auto top-up settings.
        </Text>
        <Button onClick={() => openSeerTopUpModal({organization})}>
          Open for this organization
        </Button>
      </Stack>
    );
  });
});
