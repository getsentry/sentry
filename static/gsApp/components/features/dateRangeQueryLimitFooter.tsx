import styled from '@emotion/styled';

import {Button, LinkButton, type ButtonProps} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import withOrganization from 'sentry/utils/withOrganization';

import {openUpsellModal} from 'getsentry/actionCreators/modal';
import UpgradeOrTrialButton from 'getsentry/components/upgradeOrTrialButton';
import withSubscription from 'getsentry/components/withSubscription';
import type {Subscription} from 'getsentry/types';

const BUTTON_SIZE: ButtonProps['size'] = 'sm';

interface Props {
  description: string;
  organization: Organization;
  source: string;
  subscription: Subscription;
}

function DateRangeQueryLimitFooter({
  description,
  organization,
  source,
  subscription,
}: Props) {
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
          priority="primary"
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
            onClick={() =>
              openUpsellModal({
                organization,
                source,
              })
            }
          >
            {t('Learn More')}
          </Button>
        )}
      </Flex>
    </Stack>
  );
}

export default withOrganization(
  withSubscription(DateRangeQueryLimitFooter, {noLoader: true})
);

const DescriptionContainer = styled('div')`
  font-size: 12px;
`;
