import {Fragment} from 'react';
import {IconArrow} from '@sentry/icons/arrow';

import {Button} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import * as Storybook from 'sentry/stories';
import {useOrganization} from 'sentry/utils/useOrganization';

import {SeerCreditUsageMeterView} from './seerCreditUsageMeter';

/**
 * The meter beside the send button in the chat composer's toolbar.
 */
function ComposerToolbar({children}: {children: React.ReactNode}) {
  return (
    <Flex
      justify="end"
      align="center"
      gap="md"
      padding="xs"
      border="primary"
      radius="lg"
      background="primary"
    >
      {children}
      <Button
        size="zero"
        variant="secondary"
        icon={<IconArrow />}
        aria-label="Send message"
      />
    </Flex>
  );
}

/**
 * A composer toolbar with room above it for the tooltip, which opens upwards.
 */
function NextToSendButton({children}: {children: React.ReactNode}) {
  return (
    <Flex align="end" width="420px" height="200px">
      <Container width="100%">
        <ComposerToolbar>{children}</ComposerToolbar>
      </Container>
    </Flex>
  );
}

export default Storybook.story('SeerCreditUsageMeter', story => {
  story('Auto-reload off', () => {
    const organization = useOrganization();
    return (
      <Fragment>
        <Text as="p">
          The usage meter in the Seer chat composer, for billing members of an
          organization with token-billed Seer. With auto-reload off, the tooltip counts
          monthly credits. Product code renders{' '}
          <Storybook.JSXNode
            name="SeerCreditUsageMeter"
            props={{hasEnoughCredits: true}}
          />
          , which loads the wallet; these demos render the view underneath it with the
          tooltip held open.
        </Text>
        <NextToSendButton>
          <SeerCreditUsageMeterView
            percentUsed={0.75}
            remaining={250}
            total={1000}
            autoReloadEnabled={false}
            hasEnoughCredits
            configureAutoReloadTo={`/settings/${organization.slug}/billing/overview/`}
            forceTooltipVisible
          />
        </NextToSendButton>
      </Fragment>
    );
  });

  story('Auto-reload on', () => {
    const organization = useOrganization();
    return (
      <Fragment>
        <Text as="p">
          With auto-reload on, the tooltip counts all available credits and says they
          reload automatically.
        </Text>
        <NextToSendButton>
          <SeerCreditUsageMeterView
            percentUsed={0.75}
            remaining={250}
            total={1000}
            autoReloadEnabled
            hasEnoughCredits
            configureAutoReloadTo={`/settings/${organization.slug}/billing/overview/`}
            forceTooltipVisible
          />
        </NextToSendButton>
      </Fragment>
    );
  });

  story('Out of auto-reloads', () => {
    const organization = useOrganization();
    return (
      <Fragment>
        <Text as="p">
          Auto-reload is on but the organization still can't afford a message, so it has
          used every auto-reload its threshold allows. The bar turns warning-colored and
          the tooltip links to the auto-reload settings. The out-of-credits alert sits
          above the composer at the same time.
        </Text>
        <NextToSendButton>
          <SeerCreditUsageMeterView
            percentUsed={0.95}
            remaining={50}
            total={1000}
            autoReloadEnabled
            hasEnoughCredits={false}
            configureAutoReloadTo={`/settings/${organization.slug}/billing/overview/`}
            forceTooltipVisible
          />
        </NextToSendButton>
      </Fragment>
    );
  });

  story('Out of credits with auto-reload off', () => {
    const organization = useOrganization();
    return (
      <Fragment>
        <Text as="p">
          The organization can't afford a message and auto-reload is off. The bar is
          warning-colored, and the out-of-credits alert above the composer offers to turn
          auto-reload on.
        </Text>
        <NextToSendButton>
          <SeerCreditUsageMeterView
            percentUsed={0.95}
            remaining={50}
            total={1000}
            autoReloadEnabled={false}
            hasEnoughCredits={false}
            configureAutoReloadTo={`/settings/${organization.slug}/billing/overview/`}
            forceTooltipVisible
          />
        </NextToSendButton>
      </Fragment>
    );
  });

  story('Colors', () => {
    const organization = useOrganization();
    const configureAutoReloadTo = `/settings/${organization.slug}/billing/overview/`;
    return (
      <Fragment>
        <Text as="p">
          The bar is grey below 90% used, and warning-colored from 90% or whenever the
          organization can't afford a message. The designs show grey at 80% and yellow at
          95% without naming a threshold; 90% is our pick.
        </Text>
        <Storybook.SideBySide>
          {[
            {label: '89% used', percentUsed: 0.89, hasEnoughCredits: true},
            {label: '90% used', percentUsed: 0.9, hasEnoughCredits: true},
            {label: "Can't afford a message", percentUsed: 0.6, hasEnoughCredits: false},
          ].map(({label, percentUsed, hasEnoughCredits}) => (
            <Stack key={label} gap="sm" width="200px">
              <Text variant="muted">{label}</Text>
              <ComposerToolbar>
                <SeerCreditUsageMeterView
                  percentUsed={percentUsed}
                  remaining={Math.round((1 - percentUsed) * 1000)}
                  total={1000}
                  autoReloadEnabled={false}
                  hasEnoughCredits={hasEnoughCredits}
                  configureAutoReloadTo={configureAutoReloadTo}
                />
              </ComposerToolbar>
            </Stack>
          ))}
        </Storybook.SideBySide>
      </Fragment>
    );
  });
});
