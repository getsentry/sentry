import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';

import {Flex, Stack} from '@sentry/scraps/layout';
import {Link, type LinkProps} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {ProgressBar} from 'sentry/components/progressBar';
import type {SeerCreditUsageMeterProps} from 'sentry/components/seer/outOfCredits/seerCreditUsageMeter';
import {t, tct} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';

import {
  seerWalletAutoTopUpOptions,
  seerWalletBalanceOptions,
} from 'getsentry/views/subscriptionPage/seerWallet/seerWalletOptions';

/**
 * The designs show the bar grey at 80% and warning-coloured at 95%, without a
 * threshold. It turns at 90%.
 */
const WARNING_PERCENT = 90;

export function SeerCreditUsageMeter({hasEnoughCredits}: SeerCreditUsageMeterProps) {
  const organization = useOrganization();
  // Without `seer-credit-checks` the chat looks as it did before, and only
  // token-billed orgs have a wallet to show.
  const isEnabled =
    organization.features.includes('seer-credit-checks') &&
    organization.features.includes('token-billed-seer-enabled');
  // Every member can read the wallet, but the auto-reload settings need
  // `org:billing`, so other members see the meter without them.
  const canReadAutoReload = organization.access.includes('org:billing');

  // Credits move outside this page, so recheck on window focus like the chat's
  // credit check does; the app's query client turns that off by default.
  const {data: wallet} = useQuery({
    ...seerWalletBalanceOptions(organization),
    enabled: isEnabled,
    refetchOnWindowFocus: true,
    retry: false,
  });
  const {data: autoTopUp} = useQuery({
    ...seerWalletAutoTopUpOptions(organization),
    enabled: isEnabled && canReadAutoReload,
    refetchOnWindowFocus: true,
    retry: false,
  });

  // The wallet 404s for orgs without token-billed Seer, so the meter only
  // shows once everything the member can read has loaded.
  if (!isEnabled || !wallet || (canReadAutoReload && !autoTopUp)) {
    return null;
  }

  return (
    <SeerCreditUsageMeterView
      percentUsed={wallet.percentUsed}
      remaining={wallet.balance}
      total={wallet.included.total + wallet.purchased.total}
      autoReloadEnabled={autoTopUp?.enabled ?? null}
      hasEnoughCredits={hasEnoughCredits}
      // The Seer wallet card on the billing overview is where auto-reload is
      // configured until there is an in-place modal.
      configureAutoReloadTo={`/settings/${organization.slug}/billing/overview/`}
    />
  );
}

interface SeerCreditUsageMeterViewProps {
  /**
   * `null` for members without `org:billing`, who can't read the auto-reload
   * settings.
   */
  autoReloadEnabled: boolean | null;
  /**
   * Where the tooltip links once auto-reload has run out of auto-reloads.
   */
  configureAutoReloadTo: LinkProps['to'];
  /**
   * Whether the organization can afford the operation next to the meter.
   * With auto-reload on, it can't only once the auto-reloads have run out.
   */
  hasEnoughCredits: boolean;
  /**
   * Share of included plus purchased credits used, from 0 to 1.
   */
  percentUsed: number;
  remaining: number;
  total: number;
  /**
   * Keeps the tooltip open, for stories and screenshots.
   */
  forceTooltipVisible?: boolean;
}

/**
 * The meter itself. Product code renders `SeerCreditUsageMeter`, which loads
 * the wallet; this is the presentation underneath it.
 */
export function SeerCreditUsageMeterView({
  autoReloadEnabled,
  configureAutoReloadTo,
  hasEnoughCredits,
  percentUsed,
  remaining,
  total,
  forceTooltipVisible,
}: SeerCreditUsageMeterViewProps) {
  // The balance can go negative, which would put the share used past 100%.
  const percent = Math.round(Math.min(Math.max(percentUsed, 0), 1) * 100);
  const isWarning = percent >= WARNING_PERCENT || !hasEnoughCredits;

  return (
    <Tooltip
      // `false` would force it closed, so only pass it to force it open.
      forceVisible={forceTooltipVisible || undefined}
      maxWidth={250}
      title={
        <Stack gap="lg">
          <Text>
            {autoReloadEnabled === false
              ? tct(
                  'Your organization has used [percent] of your available monthly credits.',
                  {percent: `${percent}%`}
                )
              : tct('Your organization has used [percent] of your available credits.', {
                  percent: `${percent}%`,
                })}
          </Text>
          <Text>
            {tct('[remaining]/[total] credits remaining.', {
              remaining: Math.max(remaining, 0).toLocaleString(),
              total: total.toLocaleString(),
            })}
          </Text>
          <AutoReloadStatus
            autoReloadEnabled={autoReloadEnabled}
            hasEnoughCredits={hasEnoughCredits}
            configureAutoReloadTo={configureAutoReloadTo}
          />
        </Stack>
      }
    >
      <Flex align="center" gap="xs" data-test-id="seer-credit-usage-meter">
        <Text size="sm" variant="muted" tabular>
          {`${percent}%`}
        </Text>
        <UsageBar value={percent} isWarning={isWarning} />
      </Flex>
    </Tooltip>
  );
}

function AutoReloadStatus({
  autoReloadEnabled,
  hasEnoughCredits,
  configureAutoReloadTo,
}: Pick<
  SeerCreditUsageMeterViewProps,
  'autoReloadEnabled' | 'hasEnoughCredits' | 'configureAutoReloadTo'
>) {
  // The designs only count the month's credits here; the out-of-credits alert is
  // where billing members turn auto-reload on.
  if (!autoReloadEnabled) {
    return null;
  }
  // Auto-reload is on and still can't cover a message, so the org has used
  // every auto-reload its threshold and daily usage limit allow.
  if (!hasEnoughCredits) {
    return (
      <Text>
        {tct(
          'You do not have any more auto-reloads available. [link:Configure auto-reload.]',
          {link: <Link to={configureAutoReloadTo} />}
        )}
      </Text>
    );
  }
  return <Text>{t('Credits will reload automatically.')}</Text>;
}

const UsageBar = styled(ProgressBar, {
  shouldForwardProp: prop => prop !== 'isWarning',
})<{isWarning: boolean}>`
  width: 50px;
  height: 10px;
  flex-shrink: 0;
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.full};
  background: ${p => p.theme.tokens.background.tertiary};

  &:before {
    border-radius: ${p => p.theme.radius.full};
    background-color: ${p =>
      p.isWarning
        ? p.theme.tokens.graphics.warning.vibrant
        : p.theme.tokens.graphics.neutral.moderate};
  }
`;
