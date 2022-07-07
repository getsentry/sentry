import {useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import commitImage from 'sentry-images/spot/releases-tour-commits.svg';
import emailImage from 'sentry-images/spot/releases-tour-email.svg';
import resolutionImage from 'sentry-images/spot/releases-tour-resolution.svg';
import statsImage from 'sentry-images/spot/releases-tour-stats.svg';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import Button from 'sentry/components/button';
import {TourImage, TourStep, TourText} from 'sentry/components/modals/featureTourModal';
import {Panel} from 'sentry/components/panels';
import {IconCopy} from 'sentry/icons';
import {t} from 'sentry/locale';
import {PageHeader} from 'sentry/styles/organization';
import space from 'sentry/styles/space';
import {Organization, Project, SentryApp} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import useApi from 'sentry/utils/useApi';
import useApiRequests from 'sentry/utils/useApiRequests';

const releasesSetupUrl = 'https://docs.sentry.io/product/releases/';

const docsLink = (
  <Button external href={releasesSetupUrl}>
    {t('Setup')}
  </Button>
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

const ReleasesPromo = ({organization, project}: Props) => {
  const {data, renderComponent, isLoading} = useApiRequests({
    endpoints: [
      [
        'internalIntegrations',
        `/organizations/${organization.slug}/sentry-apps/`,
        {query: {status: 'internal'}},
      ],
    ],
  });
  const api = useApi();
  const [token, setToken] = useState<string | null>(null);
  const [integration, setIntegration] = useState<SentryApp | null>(null);

  useEffect(() => {
    trackAdvancedAnalyticsEvent('releases.quickstart_viewed', {
      organization,
      project_id: project.id,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generateToken = useCallback(
    async (sentryAppSlug: string) => {
      const newToken = await api.requestPromise(
        `/sentry-apps/${sentryAppSlug}/api-tokens/`,
        {
          method: 'POST',
        }
      );
      return newToken.token;
    },
    [api]
  );

  const fetchToken = useCallback(
    async sentryAppSlug => {
      const tokens = await api.requestPromise(
        `/sentry-apps/${sentryAppSlug}/api-tokens/`
      );
      if (!tokens.length) {
        const newToken = await generateToken(sentryAppSlug);
        return setToken(newToken);
      }
      return setToken(tokens[0].token);
    },
    [api, generateToken]
  );

  const createReleaseIntegration = useCallback(async () => {
    const newIntegration = await api.requestPromise('/sentry-apps/', {
      method: 'POST',
      data: {
        name: `${project.name} Release Integration`,
        organization: organization.slug,
        isAlertable: false,
        isInternal: true,
        scopes: [
          'project:read',
          'project:write',
          'team:read',
          'team:write',
          'project:releases',
          'event:read',
          'event:write',
          'org:read',
          'org:write',
          'member:read',
          'member:write',
        ],
        verifyInstall: false,
        overview: `This internal integration was auto-generated to setup Releases for the ${project.name} project. It is needed to provide the token used to create a release. If this integration is deleted, your Releases workflow will stop working!`,
      },
    });
    return newIntegration;
  }, [api, organization.slug, project.name]);

  const getAuthToken = useCallback(async () => {
    if (!isLoading) {
      let releaseIntegration = data.internalIntegrations.find(
        i => i.name === `${project.name} Release Integration`
      );

      if (!releaseIntegration) {
        releaseIntegration = await createReleaseIntegration();
      }
      fetchToken(releaseIntegration.slug);
      setIntegration(releaseIntegration);
    }
  }, [
    isLoading,
    data.internalIntegrations,
    project.name,
    createReleaseIntegration,
    fetchToken,
  ]);
  useEffect(() => {
    if (!isLoading) {
      getAuthToken();
    }
  }, [isLoading, getAuthToken]);

  const trackQuickstartCopy = useCallback(() => {
    trackAdvancedAnalyticsEvent('releases.quickstart_copied', {
      organization,
      project_id: project.id,
    });
  }, [organization, project]);

  const handleCopy = async () => {
    if (!token && !integration) {
      addErrorMessage(t('Requires auth token!'));
      return;
    }
    const current_text = `
      # Install the cli
      curl -sL https://sentry.io/get-cli/ | SENTRY_CLI_VERSION="2.2.0" bash
      # Setup configuration values
      SENTRY_AUTH_TOKEN=${token} # From internal integration: ${integration!.name}
      SENTRY_ORG=${organization.slug}
      SENTRY_PROJECT=${project.slug}
      VERSION=\`sentry-cli releases propose-version\`
      # Workflow to create releases
      sentry-cli releases new "$VERSION"
      sentry-cli releases set-commits "$VERSION" --auto
      sentry-cli releases finalize "$VERSION"
      `;
    await navigator.clipboard.writeText(current_text);
    addSuccessMessage(t('Copied to clipboard!'));
    trackQuickstartCopy();
  };

  return renderComponent(
    <Panel>
      <Container>
        <StyledPageHeader>
          <h3>{t('Configure Releases with the CLI')}</h3>

          <Button priority="primary" size="small" href={releasesSetupUrl} external>
            {t('Full Documentation')}
          </Button>
        </StyledPageHeader>
        <p>
          {t(
            'Configuring releases associates new issues with the right version of your code and ensures the right team members are notified of these issues.'
          )}
        </p>
        <p>
          {t(
            'Add the following commands to your CI config when you deploy your application.'
          )}
        </p>

        <CodeBlock onCopy={trackQuickstartCopy}>
          <CopyButton onClick={handleCopy}>
            <IconCopy />
          </CopyButton>
          <Comment># Install the cli</Comment>
          <Bash>
            curl -sL https://sentry.io/get-cli/ | SENTRY_CLI_VERSION="2.2.0" bash
          </Bash>
          <Bash>{'\n'}</Bash>
          <Comment># Setup configuration values</Comment>
          <Bash>
            SENTRY_AUTH_TOKEN=
            {token && integration ? (
              <span style={{display: 'flex'}}>
                <Bash>{token}</Bash>
                <Comment>{` # From internal integration: ${integration.name} `}</Comment>
              </span>
            ) : (
              <Bash style={{color: '#7cc5c4'}}>{'<loading-your-token>'}</Bash>
            )}
          </Bash>

          <Bash>{`SENTRY_ORG=${organization.slug}`}</Bash>
          <Bash>{`SENTRY_PROJECT=${project.slug}`}</Bash>
          <Bash>VERSION=`sentry-cli releases propose-version`</Bash>
          <Bash>{'\n'}</Bash>
          <Comment># Workflow to create releases</Comment>
          <Bash>sentry-cli releases new "$VERSION"</Bash>
          <Bash>sentry-cli releases set-commits "$VERSION" --auto</Bash>
          <Bash>sentry-cli releases finalize "$VERSION"</Bash>
        </CodeBlock>
      </Container>
    </Panel>
  );
};

const StyledPageHeader = styled(PageHeader)`
  margin-bottom: ${space(3)};

  h3 {
    margin: 0;
  }

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    flex-direction: column;
    align-items: flex-start;

    h3 {
      margin-bottom: ${space(2)};
    }
  }
`;

const CodeBlock = styled('pre')`
  background: #251f3d;
  display: flex;
  flex-direction: column;
  padding: ${space(2)};
  overflow: initial;
  position: relative;
`;

const CopyButton = styled(Button)`
  position: absolute;
  right: 20px;
`;
const Language = styled('code')`
  font-size: 15px;
  text-shadow: none;
  direction: ltr;
  text-align: left;
  white-space: pre;
  word-spacing: normal;
  word-break: normal;
  line-height: 1.5;
  display: flex;
  align-items: center;
`;
const Bash = styled(Language)`
  color: #f2edf6;
`;

const Comment = styled(Language)`
  color: #77658b;
`;
const Container = styled('div')`
  padding: ${space(3)};
`;

export default ReleasesPromo;
