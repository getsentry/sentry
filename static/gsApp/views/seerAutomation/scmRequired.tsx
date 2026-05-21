import {Fragment} from 'react';
import {Outlet} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';

import SeerConfigBug1 from 'sentry-images/spot/seer-config-bug-1.svg';

import {LinkButton} from '@sentry/scraps/button';
import {Image} from '@sentry/scraps/image';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text, Heading} from '@sentry/scraps/text';

import {useIsSeerSupportedProvider} from 'sentry/components/events/autofix/utils';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {NoAccess} from 'sentry/components/noAccess';
import {Redirect} from 'sentry/components/redirect';
import {IconOpen} from 'sentry/icons/iconOpen';
import {t, tct} from 'sentry/locale';
import type {Integration} from 'sentry/types/integrations';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {showNewSeer} from 'sentry/utils/seer/showNewSeer';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

export default function SeerAutomationSCMRequired() {
  const organization = useOrganization();

  const hasSeatBasedSeer = organization.features.includes('seat-based-seer-enabled');
  const hasLegacySeer = organization.features.includes('seer-added');
  const hasCodeReviewBeta = organization.features.includes('code-review-beta');
  const hasGitLabSupport = organization.features.includes('seer-gitlab-support');
  const isSeerSupportedProvider = useIsSeerSupportedProvider();

  const {
    data: supportedIntegrations,
    isError,
    isPending,
  } = useQuery({
    ...apiOptions.as<Integration[]>()(
      '/organizations/$organizationIdOrSlug/integrations/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {integrationType: 'source_code_management'},
        staleTime: 0,
      }
    ),
    enabled: showNewSeer(organization),
    select: response =>
      response.json.filter(integration =>
        isSeerSupportedProvider({
          id: integration.provider.key,
          name: integration.provider.name,
        })
      ) ?? [],
  });

  if (!hasSeatBasedSeer && !hasLegacySeer && !hasCodeReviewBeta) {
    return <NoAccess />;
  }

  if (!showNewSeer(organization) && !hasCodeReviewBeta) {
    return <Redirect to={normalizeUrl(`/settings/${organization.slug}/seer/`)} />;
  }

  if (!hasSeatBasedSeer && !hasCodeReviewBeta) {
    return <Redirect to={normalizeUrl(`/settings/${organization.slug}/seer/trial/`)} />;
  }

  if (!hasSeatBasedSeer) {
    return <Outlet />;
  }

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError />;
  }

  if (!supportedIntegrations.length) {
    return (
      <Fragment>
        <SettingsPageHeader
          title={t('Connect a repository')}
          subtitle={tct(
            'Seer requires access to your source code. Seer includes [autofix:Autofix] and [code_review:Code Review]. Autofix will triage your Issues as they are created, and can automatically send them to a coding agent for Root Cause Analysis, Solution generation, and PR creation. Code Review will review your pull requests to detect issues before they happen. [docs:Read the docs] to learn what Seer can do.',
            {
              autofix: (
                <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/seer/autofix/" />
              ),
              code_review: (
                <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/seer/code-review/" />
              ),
              docs: (
                <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/seer/#seer-capabilities" />
              ),
            }
          )}
        />
        <Container display="flex" padding="2xl" border="primary" radius="md">
          <Flex flexGrow={1} justify="center">
            <Flex align="center" justify="center" gap="2xl">
              <Flex>
                <Image src={SeerConfigBug1} alt="" height="132px" />
              </Flex>
              <Stack gap="xl" maxWidth="330px">
                <Heading as="h3" size="lg">
                  {t('Connect a repository')}
                </Heading>
                <Text variant="muted" size="md">
                  {hasGitLabSupport
                    ? t(
                        'Seer requires you to have GitHub or GitLab repositories connected in order to run.'
                      )
                    : t(
                        'Seer requires you to have GitHub repositories connected in order to run.'
                      )}
                </Text>
                <Flex>
                  <LinkButton
                    variant="primary"
                    size="md"
                    icon={<IconOpen />}
                    to={`/settings/${organization.slug}/repos/`}
                  >
                    {t('Manage repositories')}
                  </LinkButton>
                </Flex>
              </Stack>
            </Flex>
          </Flex>
        </Container>
      </Fragment>
    );
  }

  return <Outlet />;
}
