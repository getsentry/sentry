import styled from '@emotion/styled';

import beamImage from 'sentry-images/spot/inc-mgmt-empty-state.svg';

import {Badge} from 'sentry/components/core/badge';
import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import {Button} from 'sentry/components/core/button/';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex, Grid} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconCalendar, IconChat, IconDocs, IconList, IconMegaphone} from 'sentry/icons';
import {t} from 'sentry/locale';
import {PluginIcon} from 'sentry/plugins/components/pluginIcon';

export default function IncidentHub() {
  return (
    <Layout.Page>
      <SentryDocumentTitle title={t('Incident Hub')} />
      <Layout.Header unified>
        <Layout.HeaderContent>
          <Layout.Title>
            {t('Incident Hub')} <FeatureBadge type="new" />
          </Layout.Title>
        </Layout.HeaderContent>
      </Layout.Header>
      <Layout.Body>
        <Layout.Main fullWidth>
          <Flex direction="column" gap="lg">
            <IncidentHubBanner />
            <IncidentHubChecklist />
          </Flex>
        </Layout.Main>
      </Layout.Body>
    </Layout.Page>
  );
}

function IncidentHubBanner() {
  return (
    <Grid
      columns="auto 1fr"
      border="primary"
      radius="md"
      padding="lg"
      gap="lg"
      align="center"
      justify="center"
    >
      <BeamImage src={beamImage} alt="Sentrypulled away from leisure time" />
      <Flex direction="column" gap="sm" justify="center" padding="xl">
        <h3>
          {t('When the beam hits,')}
          <br />
          {t('have as plan.')}
        </h3>
        <p>
          {t(
            "Preparation beats panic. Sentry's got your back with a suite of incident management tools."
          )}
        </p>
        <ButtonBar>
          <Button priority="primary">{t('Setup Incident Management')}</Button>
          <LinkButton href={'https://docs.sentry.io/'} external>
            {t('Read Docs')}
          </LinkButton>
        </ButtonBar>
      </Flex>
    </Grid>
  );
}

function IncidentHubChecklist() {
  const checklistItems = [
    {
      icon: IconCalendar,
      heading: t('Configure a rotation schedule'),
      subtext: t('Share the responsibility across your team.'),
      buttons: [
        {
          icon: <PluginIcon pluginId="sentry" />,
          label: t('Sentry'),
          comingSoon: true,
        },
        {
          icon: <PluginIcon pluginId="pagerduty" />,
          label: t('PagerDuty'),
        },
      ],
      completed: true,
    },
    {
      icon: IconList,
      heading: t('Connect a task keeper'),
      subtext: t('Keep track of action items, during and after the incident.'),
      buttons: [
        {
          icon: <PluginIcon pluginId="linear" />,
          label: t('Linear'),
        },
        {
          icon: <PluginIcon pluginId="jira" />,
          label: t('Jira'),
        },
      ],
      completed: false,
    },
    {
      icon: IconChat,
      heading: t('Scope out your discussions'),
      subtext: t('Reserve a space for focused discussions.'),
      completed: false,
      buttons: [
        {
          icon: <PluginIcon pluginId="slack" />,
          label: t('Slack'),
        },
        {
          icon: <PluginIcon pluginId="msteams" />,
          label: t('MS Teams'),
        },
        {
          icon: <PluginIcon pluginId="discord" />,
          label: t('Discord'),
        },
      ],
    },
    {
      icon: IconMegaphone,
      heading: t('Communicate to your users'),
      subtext: t('Share the status of your incidents publicly.'),
      completed: false,
      buttons: [
        {
          icon: <PluginIcon pluginId="sentry" />,
          label: t('Sentry'),
          comingSoon: true,
        },
        {
          icon: <PluginIcon pluginId="statuspage" />,
          label: t('Statuspage'),
        },
      ],
    },
    {
      icon: IconDocs,
      heading: t('Take the learnings'),
      subtext: t('An ounce of prevention is worth a pound of cure.'),
      buttons: [
        {
          icon: <PluginIcon pluginId="confluence" />,
          label: t('Confluence'),
        },
        {
          icon: <PluginIcon pluginId="notion" />,
          label: t('Notion'),
        },
        {
          icon: <PluginIcon pluginId="google-docs" />,
          label: t('Google Docs'),
        },
      ],
      completed: false,
    },
  ];

  return (
    <Flex direction="column" gap="sm" border="primary" radius="md" padding="xl">
      <h3 style={{margin: 0}}>{t('Connect your tools')}</h3>
      <p style={{margin: 0}}>
        {t(
          'Get the most out of your workflow now, so you can focus on fighting fires when they happen.'
        )}
      </p>
      <ChecklistContainer>
        {checklistItems.map((item, index) => (
          <ChecklistItem key={index} isLast={index === checklistItems.length - 1}>
            <ChecklistCircle completed={item.completed}>
              <item.icon size="md" />
            </ChecklistCircle>
            <Flex direction="column" gap="sm">
              <Heading as="h4" size="lg">
                {item.heading}
              </Heading>
              <Text variant="muted">{item.subtext}</Text>
              <Flex gap="md" align="start">
                {item.buttons.map(button => (
                  <Button
                    key={button.label}
                    size="sm"
                    icon={button.icon}
                    disabled={button.comingSoon}
                  >
                    {button.label}{' '}
                    {button.comingSoon && (
                      <Badge type="experimental">{t('Coming Soon')}</Badge>
                    )}
                  </Button>
                ))}
              </Flex>
            </Flex>
          </ChecklistItem>
        ))}
      </ChecklistContainer>
    </Flex>
  );
}

const BeamImage = styled('img')`
  display: block;
  flex: 1;
`;

const ChecklistContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space['3xl']};
  margin-top: ${p => p.theme.space.lg};
`;

const ChecklistItem = styled('div')<{isLast: boolean}>`
  position: relative;
  display: grid;
  grid-template-columns: 2.5rem 1fr;
  gap: ${p => p.theme.space.lg};
  &:not(:last-child)::after {
    content: '';
    position: absolute;
    left: 1.25rem;
    top: 2.5rem;
    width: 1px;
    height: calc(100% + ${p => p.theme.space.lg});
    background: ${p => p.theme.border};
    z-index: 1;
  }
`;

const ChecklistCircle = styled('div')<{completed: boolean}>`
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  background: ${p => (p.completed ? p.theme.green300 : p.theme.backgroundSecondary)};
  border: 1px solid ${p => (p.completed ? p.theme.green300 : p.theme.border)};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${p => (p.completed ? p.theme.white : p.theme.subText)};
  margin-right: 1rem;
  flex-shrink: 0;
  z-index: 2;
`;
