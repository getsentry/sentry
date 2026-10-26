import type {ReactNode} from 'react';
import {Fragment} from 'react';

import {Alert} from '@sentry/scraps/alert';
import {Button, LinkButton} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {t, tct} from 'sentry/locale';
import {
  platformEventLinkMap,
  PlatformEvents,
} from 'sentry/utils/analytics/integrations/platformAnalyticsEvents';
import {trackIntegrationAnalytics} from 'sentry/utils/integrationUtil';
import {useOrganization} from 'sentry/utils/useOrganization';
import {getSentryAppTemplates} from 'sentry/views/settings/organizationDeveloperSettings/creationTemplates';
import {ExampleIntegrationButton} from 'sentry/views/settings/organizationIntegrations/exampleIntegrationButton';

const analyticsView = 'new_integration_modal';

function CreateNewIntegrationModal({Body, Header, Footer, closeModal}: ModalRenderProps) {
  const organization = useOrganization();
  const templates = getSentryAppTemplates();
  const baseUrl = `/settings/${organization.slug}/developer-settings/`;

  return (
    <Fragment>
      <Header>
        <Flex justify="between" align="center" width="100%">
          <h3>{t('Choose Integration Type')}</h3>
          <ExampleIntegrationButton analyticsView={analyticsView} />
        </Flex>
      </Header>
      <Body>
        <Alert.Container>
          <Alert variant="info">
            {tct(
              'Looking for MCP? Connect Sentry to AI-powered tools and your terminal from the [link:MCP & CLI] page.',
              {
                link: (
                  <Link
                    to={`/settings/${organization.slug}/mcp-cli/`}
                    onClick={() => {
                      trackIntegrationAnalytics(PlatformEvents.MCP_CLI_HINT, {
                        organization,
                        view: analyticsView,
                      });
                    }}
                  />
                ),
              }
            )}
          </Alert>
        </Alert.Container>
        <Stack gap="xl">
          <Stack gap="sm">
            <Text bold>{t('Start from scratch')}</Text>
            <Stack border="primary" radius="md">
              <ChoiceRow
                title={t('Internal Integration')}
                description={tct(
                  'Internal integrations are meant for custom integrations unique to your organization. See more info on [docsLink].',
                  {
                    docsLink: (
                      <ExternalLink
                        href={platformEventLinkMap[PlatformEvents.INTERNAL_DOCS]}
                        onClick={() => {
                          trackIntegrationAnalytics(PlatformEvents.INTERNAL_DOCS, {
                            organization,
                            view: analyticsView,
                          });
                        }}
                      >
                        {t('Internal Integrations')}
                      </ExternalLink>
                    ),
                  }
                )}
                action={
                  <LinkButton
                    variant="secondary"
                    size="sm"
                    to={`${baseUrl}new-internal/`}
                    onClick={() => {
                      trackIntegrationAnalytics(PlatformEvents.CHOSE_INTERNAL, {
                        organization,
                        view: analyticsView,
                      });
                      closeModal();
                    }}
                  >
                    {t('Get started')}
                  </LinkButton>
                }
              />
              <Stack.Separator />
              <ChoiceRow
                title={t('Public Integration')}
                description={tct(
                  'A public integration will be available for all Sentry users for installation. See more info on [docsLink].',
                  {
                    docsLink: (
                      <ExternalLink
                        href={platformEventLinkMap[PlatformEvents.PUBLIC_DOCS]}
                        onClick={() => {
                          trackIntegrationAnalytics(PlatformEvents.PUBLIC_DOCS, {
                            organization,
                            view: analyticsView,
                          });
                        }}
                      >
                        {t('Public Integrations')}
                      </ExternalLink>
                    ),
                  }
                )}
                action={
                  <LinkButton
                    variant="secondary"
                    size="sm"
                    to={`${baseUrl}new-public/`}
                    onClick={() => {
                      trackIntegrationAnalytics(PlatformEvents.CHOSE_PUBLIC, {
                        organization,
                        view: analyticsView,
                      });
                      closeModal();
                    }}
                  >
                    {t('Get started')}
                  </LinkButton>
                }
              />
            </Stack>
          </Stack>
          {templates.length > 0 && (
            <Stack gap="sm">
              <Stack gap="2xs">
                <Text bold>{t('Templates')}</Text>
                <Text variant="muted" size="sm">
                  {t('Get started with a pre-configured internal integration.')}
                </Text>
              </Stack>
              <Stack border="primary" radius="md">
                {templates.map((template, index) => (
                  <Fragment key={template.slug}>
                    {index > 0 && <Stack.Separator />}
                    <ChoiceRow
                      title={template.heading}
                      description={template.description}
                      action={
                        <LinkButton
                          variant="secondary"
                          size="sm"
                          to={`${baseUrl}new-internal/?template=${template.slug}&referrer=new_integration_modal`}
                          onClick={() => {
                            trackIntegrationAnalytics(PlatformEvents.CHOSE_INTERNAL, {
                              organization,
                              view: analyticsView,
                            });
                            closeModal();
                          }}
                        >
                          {t('Use template')}
                        </LinkButton>
                      }
                    />
                  </Fragment>
                ))}
              </Stack>
            </Stack>
          )}
        </Stack>
      </Body>
      <Footer>
        <Button size="sm" onClick={() => closeModal()}>
          {t('Cancel')}
        </Button>
      </Footer>
    </Fragment>
  );
}

function ChoiceRow({
  title,
  description,
  action,
}: {
  action: ReactNode;
  description: ReactNode;
  title: ReactNode;
}) {
  return (
    <Flex justify="between" align="center" gap="xl" padding="md lg">
      <Stack gap="2xs">
        <Text bold>{title}</Text>
        <Text variant="muted" size="sm">
          {description}
        </Text>
      </Stack>
      {action}
    </Flex>
  );
}

export default CreateNewIntegrationModal;
