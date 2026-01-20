import {useCallback, useEffect, useState} from 'react';

import commitImage from 'sentry-images/spot/releases-tour-commits.svg';
import emailImage from 'sentry-images/spot/releases-tour-email.svg';
import resolutionImage from 'sentry-images/spot/releases-tour-resolution.svg';
import statsImage from 'sentry-images/spot/releases-tour-stats.svg';

import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {openCreateReleaseIntegration} from 'sentry/actionCreators/modal';
import {SentryAppAvatar} from 'sentry/components/core/avatar/sentryAppAvatar';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {CodeBlock} from 'sentry/components/core/code';
import {CompactSelect, type SelectOption} from 'sentry/components/core/compactSelect';
import {Flex, Stack} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import type {TourStep} from 'sentry/components/modals/featureTourModal';
import {TourImage, TourText} from 'sentry/components/modals/featureTourModal';
import Panel from 'sentry/components/panels/panel';
import {t} from 'sentry/locale';
import type {SentryApp} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {NewInternalAppApiToken} from 'sentry/types/user';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useApiQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';

const releasesSetupUrl = 'https://docs.sentry.io/product/releases/';

const docsLink = (
  <LinkButton external href={releasesSetupUrl}>
    {t('Setup')}
  </LinkButton>
);

export const RELEASES_TOUR_STEPS: TourStep[] = [
  {
    title: t('Suspect Commits'),
    image: <TourImage src={commitImage} />,
    body: (
      <TourText>
        {t(
          'Sentry suggests which commit caused an issue and who is likely responsible so you can triage.'
        )}
      </TourText>
    ),
    actions: docsLink,
  },
  {
    title: t('Release Stats'),
    image: <TourImage src={statsImage} />,
    body: (
      <TourText>
        {t(
          'Get an overview of the commits in each release, and which issues were introduced or fixed.'
        )}
      </TourText>
    ),
    actions: docsLink,
  },
  {
    title: t('Easily Resolve'),
    image: <TourImage src={resolutionImage} />,
    body: (
      <TourText>
        {t(
          'Automatically resolve issues by including the issue number in your commit message.'
        )}
      </TourText>
    ),
    actions: docsLink,
  },
  {
    title: t('Deploy Emails'),
    image: <TourImage src={emailImage} />,
    body: (
      <TourText>
        {t(
          'Receive email notifications about when your code gets deployed. This can be customized in settings.'
        )}
      </TourText>
    ),
  },
];

type Props = {
  organization: Organization;
  project: Project;
};

function ReleasesPromo({organization, project}: Props) {
  const {data, isPending} = useApiQuery<SentryApp[]>(
    [`/organizations/${organization.slug}/sentry-apps/`, {query: {status: 'internal'}}],
    {
      staleTime: 0,
    }
  );

  const api = useApi();
  const [token, setToken] = useState<string | null>(null);
  const [apps, setApps] = useState<SentryApp[]>([]);
  const [selectedApp, setSelectedApp] = useState<SentryApp | null>(null);

  useEffect(() => {
    if (!isPending && data) {
      setApps(data);
    }
  }, [isPending, data]);

  useEffect(() => {
    trackAnalytics('releases.quickstart_viewed', {
      organization,
      project_id: project.id,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const trackQuickstartCopy = useCallback(() => {
    trackAnalytics('releases.quickstart_copied', {
      organization,
      project_id: project.id,
    });
  }, [organization, project]);

  const trackQuickstartCreatedIntegration = useCallback(
    (integration: SentryApp) => {
      trackAnalytics('releases.quickstart_create_integration.success', {
        organization,
        project_id: project.id,
        integration_uuid: integration.uuid,
      });
    },
    [organization, project]
  );

  const trackCreateIntegrationModalClose = useCallback(() => {
    trackAnalytics('releases.quickstart_create_integration_modal.close', {
      organization,
      project_id: project.id,
    });
  }, [organization, project.id]);

  const generateAndSetNewToken = async (sentryAppSlug: string) => {
    const newToken = await generateToken(sentryAppSlug);
    return setToken(newToken);
  };

  const generateToken = async (sentryAppSlug: string) => {
    const newToken: NewInternalAppApiToken = await api.requestPromise(
      `/sentry-apps/${sentryAppSlug}/api-tokens/`,
      {
        method: 'POST',
      }
    );
    return newToken.token;
  };

  const makeAppOption = (app: SentryApp): SelectOption<string> => {
    return {
      value: app.slug,
      leadingItems: <SentryAppAvatar sentryApp={app} size={16} />,
      textValue: app.name,
      label: app.name,
    };
  };

  const setupExample = `# Install the cli
curl -sL https://sentry.io/get-cli/ | bash

# Setup configuration values
export SENTRY_AUTH_TOKEN=${
    token && selectedApp
      ? `${token} # From internal integration: ${selectedApp.name}`
      : '[select an integration above]'
  }
export SENTRY_ORG=${organization.slug}
export SENTRY_PROJECT=${project.slug}
VERSION=\`sentry-cli releases propose-version\`

# Workflow to create releases
sentry-cli releases new "$VERSION"
sentry-cli releases set-commits "$VERSION" --auto
sentry-cli releases finalize "$VERSION"`;

  if (isPending) {
    return <LoadingIndicator />;
  }

  const canMakeIntegration = organization.access.includes('org:integrations');

  return (
    <Panel>
      <Stack padding="xl" gap="xl">
        <Flex align="center" justify="between">
          <Heading as="h2">{t('Set up Releases')}</Heading>
          <LinkButton size="sm" href={releasesSetupUrl} external>
            {t('Full Documentation')}
          </LinkButton>
        </Flex>
        <Text>
          {t(
            'Find which release caused an issue, apply source maps, and get notified about your deploys.'
          )}
        </Text>
        <Text>
          {t(
            'Select an Integration to provide your Auth Token, then add the following script to your CI config when you deploy your application.'
          )}
        </Text>

        <CompactSelect
          size="sm"
          options={apps.map(makeAppOption)}
          value={selectedApp?.slug}
          emptyMessage={t('No Integrations')}
          searchable
          disabled={false}
          menuFooter={({closeOverlay}) => (
            <Button
              title={
                canMakeIntegration
                  ? undefined
                  : t(
                      'You must be an organization owner, manager or admin to create an integration.'
                    )
              }
              size="xs"
              borderless
              disabled={!canMakeIntegration}
              onClick={() => {
                closeOverlay();
                openCreateReleaseIntegration({
                  organization,
                  project,
                  onCreateSuccess: (app: SentryApp) => {
                    setApps([app, ...apps]);
                    setSelectedApp(app);
                    generateAndSetNewToken(app.slug);
                    trackQuickstartCreatedIntegration(app);
                  },
                  onCancel: trackCreateIntegrationModalClose,
                });
              }}
            >
              {t('Add New Integration')}
            </Button>
          )}
          trigger={triggerProps => (
            <OverlayTrigger.Button
              {...triggerProps}
              prefix={selectedApp ? t('Token From') : undefined}
            >
              {selectedApp ? triggerProps.children : t('Select Integration')}
            </OverlayTrigger.Button>
          )}
          onChange={option => {
            const app = apps.find(i => i.slug === option.value)!;
            setSelectedApp(app);
            generateAndSetNewToken(app.slug);
          }}
        />

        <CodeBlock
          dark
          language="bash"
          hideCopyButton={!token || !selectedApp}
          onCopy={trackQuickstartCopy}
        >
          {setupExample}
        </CodeBlock>
      </Stack>
    </Panel>
  );
}

export default ReleasesPromo;
