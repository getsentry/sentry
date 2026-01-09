import {Fragment, useEffect} from 'react';
import {useNavigate} from 'react-router-dom';
import seerConfigBug1 from 'getsentry-images/spot/seer-config-bug-1.svg';
import seerConfigCheck from 'getsentry-images/spot/seer-config-check.svg';
import seerConfigConnect2 from 'getsentry-images/spot/seer-config-connect-2.svg';
import seerConfigHand2 from 'getsentry-images/spot/seer-config-hand-2.svg';
import seerConfigMain from 'getsentry-images/spot/seer-config-main.svg';

import {Alert} from '@sentry/scraps/alert/alert';
import {LinkButton} from '@sentry/scraps/button/linkButton';
import InteractionStateLayer from '@sentry/scraps/interactionStateLayer/interactionStateLayer';
import {Container} from '@sentry/scraps/layout/container';
import {Flex} from '@sentry/scraps/layout/flex';
import {Grid} from '@sentry/scraps/layout/grid';
import {Stack} from '@sentry/scraps/layout/stack';
import {ExternalLink} from '@sentry/scraps/link/link';
import {Heading} from '@sentry/scraps/text/heading';
import {Text} from '@sentry/scraps/text/text';

import {IconUpgrade} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import showNewSeer from 'sentry/utils/seer/showNewSeer';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useOrganization from 'sentry/utils/useOrganization';

import useSubscription from 'getsentry/hooks/useSubscription';
import {hasAccessToSubscriptionOverview} from 'getsentry/utils/billing';

const BUTTONS = [
  {
    label: t('Triage issues'),
    imageSrc: seerConfigHand2,
    href: 'https://docs.sentry.io/product/ai-in-sentry/seer/issue-fix/',
  },
  {
    label: t('Run root cause analysis'),
    imageSrc: seerConfigConnect2,
    href: 'https://docs.sentry.io/product/ai-in-sentry/seer/issue-fix/#root-cause-analysis',
  },
  {
    label: t('Make code changes'),
    imageSrc: seerConfigBug1,
    href: 'https://docs.sentry.io/product/ai-in-sentry/seer/issue-fix/#code-generation',
  },
  {
    label: t('Review your code'),
    imageSrc: seerConfigCheck,
    href: 'https://docs.sentry.io/product/ai-in-sentry/ai-code-review/',
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
      navigate(normalizeUrl(`/organizations/${organization.slug}/settings/seer/`));
      return;
    }

    // If you've already got Seer, then go to settings and you should see the new ones.
    if (organization.features.includes('seat-based-seer-enabled')) {
      navigate(normalizeUrl(`/organizations/${organization.slug}/settings/seer/`));
      return;
    }

    // Else you don't yet have the new seer plan, then stay here and click to start a trial.
  }, [navigate, organization.features, organization.slug, organization]);

  return (
    <Fragment>
      <Flex justify="center">
        <img
          src={seerConfigMain}
          alt="Seer"
          style={{
            maxWidth: '90%',
            marginTop: '-40px',
            marginBottom: '-77px',
            transform: 'rotate(1.281deg)',
          }}
        />
      </Flex>

      <Container
        padding="2xl xl"
        border="primary"
        radius="lg"
        background="secondary"
        maxWidth="600px"
        margin="auto"
      >
        <Stack gap="lg">
          <Heading as="h1" align="center">
            {t('Say Hello to a Smarter Sentry')}
          </Heading>
          <Text>
            {tct(
              `Meet Seer: Sentry’s AI agent that helps you troubleshoot and fix
            problems with your application, review your PRs, propose solutions
            to your bugs and performance issues, and even partner with coding
            agents to implement fixes in code. Learn more about Seer [link:here]!`,
              {
                link: (
                  <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/seer/" />
                ),
              }
            )}
          </Text>

          <Heading as="h3" align="center">
            {t('Seer is able to...')}
          </Heading>
          <Text as="div" bold>
            <Grid
              as="ul"
              columns="repeat(2, 1fr)"
              gap="xl 2xl"
              padding="lg"
              style={{listStyle: 'none'}}
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
                    style={{position: 'relative'}}
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
          <Flex align="center" justify="center" paddingTop="lg">
            {canVisitSubscriptionPage ? (
              <LinkButton
                to={`/settings/${organization.slug}/billing/overview/?product=seer`}
                priority="primary"
                icon={<IconUpgrade />}
              >
                {t('Try Out Seer Now')}
              </LinkButton>
            ) : (
              <Alert variant="warning">
                {t(
                  'You need to be a billing member to try out Seer. Please contact your organization owner to upgrade your plan.'
                )}
              </Alert>
            )}
          </Flex>
        </Stack>
      </Container>
    </Fragment>
  );
}
