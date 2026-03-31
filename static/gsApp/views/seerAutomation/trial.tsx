import {useEffect} from 'react';
import {useNavigate} from 'react-router-dom';
import styled from '@emotion/styled';
import seerConfigBug1 from 'getsentry-images/spot/seer-config-bug-1.svg';
import seerConfigCheck from 'getsentry-images/spot/seer-config-check.svg';
import seerConfigConnect2 from 'getsentry-images/spot/seer-config-connect-2.svg';
import seerConfigHand2 from 'getsentry-images/spot/seer-config-hand-2.svg';
import seerConfigMain from 'getsentry-images/spot/seer-config-main.svg';

import {Alert} from '@sentry/scraps/alert';
import {LinkButton} from '@sentry/scraps/button';
import {Image} from '@sentry/scraps/image';
import InteractionStateLayer from '@sentry/scraps/interactionStateLayer';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';

import {AnalyticsArea, useAnalyticsArea} from 'sentry/components/analyticsArea';
import {IconUpgrade} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {useRouteAnalyticsParams} from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import {showNewSeer} from 'sentry/utils/seer/showNewSeer';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';

import {useSubscription} from 'getsentry/hooks/useSubscription';
import {hasAccessToSubscriptionOverview} from 'getsentry/utils/billing';

const BUTTONS = [
  {
    label: t('Triage issues'),
    imageSrc: seerConfigHand2,
    href: 'https://docs.sentry.io/product/ai-in-sentry/seer/autofix/#how-issue-autofix-works',
  },
  {
    label: t('Run root cause analysis'),
    imageSrc: seerConfigConnect2,
    href: 'https://docs.sentry.io/product/ai-in-sentry/seer/autofix/#root-cause-analysis',
  },
  {
    label: t('Make code changes'),
    imageSrc: seerConfigBug1,
    href: 'https://docs.sentry.io/product/ai-in-sentry/seer/autofix/#code-generation',
  },
  {
    label: t('Review your code'),
    imageSrc: seerConfigCheck,
    href: 'https://docs.sentry.io/product/ai-in-sentry/seer/code-review/',
  },
];

export default function SeerAutomationTrial() {
  const navigate = useNavigate();
  const organization = useOrganization();
  const subscription = useSubscription();

  const canVisitSubscriptionPage = hasAccessToSubscriptionOverview(
    subscription,
    organization
  );

  useEffect(() => {
    // If the org is on the old-seer plan then they shouldn't be here on this new settings page
    // they need to goto the old settings page, or get downgraded off old seer.
    if (!showNewSeer(organization)) {
      navigate(normalizeUrl(`/settings/${organization.slug}/seer/`));
      return;
    }

    // If you've already got Seer, then go to settings and you should see the new ones.
    if (organization.features.includes('seat-based-seer-enabled')) {
      navigate(normalizeUrl(`/settings/${organization.slug}/seer/`));
      return;
    }

    // Else you don't yet have the new seer plan, then stay here and click to start a trial.
  }, [navigate, organization.features, organization.slug, organization]);

  useRouteAnalyticsParams({
    showNewSeer: showNewSeer(organization),
    hasSeatBasedSeer: organization.features.includes('seat-based-seer-enabled'),
    canVisitSubscriptionPage,
  });

  return (
    <AnalyticsArea name="trial">
      <Flex justify="center">
        <HeroImage src={seerConfigMain} aspectRatio="1119/526" alt="Seer hero image" />
      </Flex>

      <Container
        padding="2xl xl"
        border="primary"
        radius="lg"
        background="secondary"
        maxWidth="600px"
        margin="auto"
        position="relative"
      >
        <Stack gap="lg">
          <Heading as="h1" align="center">
            {t('Say Hello to a Smarter Sentry')}
          </Heading>
          <Flex align="center" justify="center" paddingBottom="xl">
            {canVisitSubscriptionPage ? (
              <TrySeerNowButton />
            ) : (
              <Alert variant="warning">
                {t(
                  'You need to be a billing member to try out Seer. Please contact your organization owner to upgrade your plan.'
                )}
              </Alert>
            )}
          </Flex>

          <Text>
            {tct(
              `With Seer, issues [em:almost] fix themselves. Choose your favorite coding agent and run Autofix on Issues as they're detected, and use Code Review to prevent bugs before they happen. [docs:Read the docs] for more.`,
              {
                em: <em />,
                docs: (
                  <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/seer/" />
                ),
              }
            )}
          </Text>

          <Text as="div" bold>
            <Grid
              as="ul"
              columns="repeat(2, 1fr)"
              gap="xl 2xl"
              style={{padding: 0, margin: 0, listStyle: 'none'}}
            >
              {BUTTONS.map(({label, imageSrc, href}) => {
                return (
                  <Container
                    key={`seer-automation-trial-${label}`}
                    as="li"
                    border="primary"
                    radius="md"
                    background="tertiary"
                    padding="md"
                    position="relative"
                  >
                    <InteractionStateLayer />
                    <ExternalLink href={href}>
                      <Flex gap="lg" align="center">
                        <img width="44" height="44" alt="" src={imageSrc} />
                        {label}
                      </Flex>
                    </ExternalLink>
                  </Container>
                );
              })}
            </Grid>
          </Text>
        </Stack>
      </Container>
    </AnalyticsArea>
  );
}

const HeroImage = styled(Image)`
  width: auto;
  max-width: 90%;
  max-height: 50vh;
  margin-top: -40px;
  margin-bottom: -77px;
`;

function TrySeerNowButton() {
  const organization = useOrganization();
  const surface = useAnalyticsArea();

  return (
    <LinkButton
      to={`/settings/${organization.slug}/billing/overview/?product=seer`}
      priority="primary"
      icon={<IconUpgrade />}
      analyticsEventKey="clicked.try_seer_button"
      analyticsEventName="Clicked: Try Seer Now"
      analyticsParams={{
        surface,
      }}
    >
      {t('Try Seer Now')}
    </LinkButton>
  );
}
