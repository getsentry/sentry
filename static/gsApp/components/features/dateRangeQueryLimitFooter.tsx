import styled from '@emotion/styled';

import {Button, LinkButton, type ButtonProps} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';

import {openUpsellModal} from 'getsentry/actionCreators/modal';
import {UpgradeOrTrialButton} from 'getsentry/components/upgradeOrTrialButton';
import {useSubscription} from 'getsentry/hooks/useSubscription';
import type {Subscription} from 'getsentry/types';

const BUTTON_SIZE: ButtonProps['size'] = 'sm';

interface Props {
  description: string;
  source: string;
}

export function DateRangeQueryLimitFooter(props: Props) {
  const subscription = useSubscription();

  if (!subscription) {
    return null;
  }

  return <DateRangeQueryLimitFooterContent {...props} subscription={subscription} />;
}

function DateRangeQueryLimitFooterContent({
  description,
  source,
  subscription,
}: Props & {subscription: Subscription}) {
  const organization = useOrganization();
  const checkoutUrl = normalizeUrl(
    `/checkout/${organization.slug}/?referrer=checkout-${source}`
  );

  const canTrial = subscription.canTrial;

  return (
    <Stack padding="xs" gap="md">
      <DescriptionContainer>{description}</DescriptionContainer>
      <Flex gap="md">
        <UpgradeOrTrialButton
          subscription={subscription}
          variant="primary"
          size={BUTTON_SIZE}
          organization={organization}
          source={source}
          aria-label="Start Trial"
        >
          {canTrial ? t('Start Trial') : t('Upgrade Now')}
        </UpgradeOrTrialButton>
        {canTrial && (
          <LinkButton size={BUTTON_SIZE} to={checkoutUrl}>
            {t('Upgrade Now')}
          </LinkButton>
        )}
        {!canTrial && (
          <Button
            size={BUTTON_SIZE}
            onClick={() => openUpsellModal({organization, source})}
          >
            {t('Learn More')}
          </Button>
        )}
      </Flex>
    </Stack>
  );
}

const DescriptionContainer = styled('div')`
  font-size: 12px;
`;
