import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
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
          The modal the billing page's Seer wallet card and the out-of-credits CTA open,
          and that any page opens from a link ending in{' '}
          <code>#open-seer-auto-reload-modal</code>. It loads your organization's Seer
          wallet; organizations without token-billed Seer get the load error and its
          retry. Saving changes the real auto-reload settings.
        </Text>
        <Button onClick={() => openSeerAutoTopUpModal({organization})}>
          Open for this organization
        </Button>
      </Stack>
    );
  });

  story('Without billing access', () => {
    const organization = useOrganization();
    const member = {
      ...organization,
      access: organization.access.filter(scope => scope !== 'org:billing'),
    };

    return (
      <Stack gap="md" align="start">
        <Text as="p">
          Members without billing access can't change auto-reload, so the modal asks them
          to contact their admins. A link can say why Seer stopped, as in{' '}
          <code>#open-seer-auto-reload-modal:daily_cap_exceeded</code>. Members of
          self-serve organizations get Contact Admin, which sends your admins a real email
          about that reason, or the auto-reload request without one.
        </Text>
        <Flex gap="md" wrap="wrap">
          <Button
            onClick={() =>
              openSeerAutoTopUpModal({
                organization: member,
                denialReason: 'not_enough_credits',
              })
            }
          >
            Out of credits
          </Button>
          <Button
            onClick={() =>
              openSeerAutoTopUpModal({
                organization: member,
                denialReason: 'daily_cap_exceeded',
              })
            }
          >
            Daily usage limit
          </Button>
          <Button onClick={() => openSeerAutoTopUpModal({organization: member})}>
            No reason
          </Button>
        </Flex>
      </Stack>
    );
  });
});
