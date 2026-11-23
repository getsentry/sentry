import {Button} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import * as Storybook from 'sentry/stories';
import {useOrganization} from 'sentry/utils/useOrganization';

import {openSeerAutoTopUpModal} from 'getsentry/views/subscriptionPage/seerWallet/autoTopUpModal';

export default Storybook.story('Seer auto-reload modal', story => {
  story("Your organization's wallet", () => {
    const organization = useOrganization();

    return (
      <Stack gap="md" align="start">
        <Text as="p">
          The modal the billing page's Seer wallet card and the out-of-credits CTA open.
          It loads your organization's Seer wallet; organizations without token-billed
          Seer get the load error and its retry. Saving changes the real auto-reload
          settings.
        </Text>
        <Button onClick={() => openSeerAutoTopUpModal({organization})}>
          Open for this organization
        </Button>
      </Stack>
    );
  });
});
