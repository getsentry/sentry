import {Fragment} from 'react';
import {IconArrow} from '@sentry/icons/arrow';

import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import * as Storybook from 'sentry/stories';
import {useOrganization} from 'sentry/utils/useOrganization';

import {SeerCreditUsageMeterView} from './seerCreditUsageMeter';

/**
 * The meter beside a send button, as in the chat composer, with room above it
 * for the tooltip, which opens upwards.
 */
function NextToSendButton({children}: {children: React.ReactNode}) {
  return (
    <Flex align="end" justify="end" width="420px" height="200px">
      <Flex align="center" gap="sm">
        {children}
        <Button
          size="md"
          variant="secondary"
          icon={<IconArrow direction="right" />}
          aria-label="Send message"
        />
      </Flex>
    </Flex>
  );
}

export default Storybook.story('SeerCreditUsageMeter', story => {
  story('Auto reload off', () => {
    const organization = useOrganization();
    return (
      <Fragment>
        <Text as="p">
          The usage meter in the Seer chat composer, for billing members of an
          organization with token-billed Seer. With auto reload off, the tooltip counts
          monthly credits and links to turning auto reload on. Product code renders{' '}
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

  story('Auto reload on', () => {
    const organization = useOrganization();
    return (
      <Fragment>
        <Text as="p">
          With auto reload on, the tooltip counts all available credits and says they
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

  story('Out of reloads', () => {
    const organization = useOrganization();
    return (
      <Fragment>
        <Text as="p">
          Auto reload is on but the organization still can't afford a message, so it has
          used every top-up its threshold allows. The bar turns warning-colored and the
          tooltip links to the threshold. The out-of-credits alert sits above the composer
          at the same time.
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

  story('Out of credits with auto reload off', () => {
    const organization = useOrganization();
    return (
      <Fragment>
        <Text as="p">
          The organization can't afford a message and auto reload is off. The bar is
          warning-colored and the tooltip still offers to turn auto reload on, next to the
          out-of-credits alert above the composer.
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
            <Stack key={label} gap="sm" align="start">
              <Text variant="muted">{label}</Text>
              <Flex align="center" gap="sm">
                <SeerCreditUsageMeterView
                  percentUsed={percentUsed}
                  remaining={Math.round((1 - percentUsed) * 1000)}
                  total={1000}
                  autoReloadEnabled={false}
                  hasEnoughCredits={hasEnoughCredits}
                  configureAutoReloadTo={configureAutoReloadTo}
                />
                <Button
                  size="md"
                  variant="secondary"
                  icon={<IconArrow direction="right" />}
                  aria-label="Send message"
                />
              </Flex>
            </Stack>
          ))}
        </Storybook.SideBySide>
      </Fragment>
    );
  });
});
