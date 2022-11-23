import {useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import commitImage from 'sentry-images/spot/releases-tour-commits.svg';
import emailImage from 'sentry-images/spot/releases-tour-email.svg';
import resolutionImage from 'sentry-images/spot/releases-tour-resolution.svg';
import statsImage from 'sentry-images/spot/releases-tour-stats.svg';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openCreateReleaseIntegration} from 'sentry/actionCreators/modal';
import Access from 'sentry/components/acl/access';
import Button from 'sentry/components/button';
import DropdownAutoComplete from 'sentry/components/dropdownAutoComplete';
import {Item} from 'sentry/components/dropdownAutoComplete/types';
import Link from 'sentry/components/links/link';
import {TourImage, TourStep, TourText} from 'sentry/components/modals/featureTourModal';
import {Panel} from 'sentry/components/panels';
import TextOverflow from 'sentry/components/textOverflow';
import Tooltip from 'sentry/components/tooltip';
import {IconAdd, IconCopy} from 'sentry/icons';
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
  const {data, renderComponent, isLoading} = useApiRequests<{
    internalIntegrations: SentryApp[];
  }>({
    endpoints: [
      [
        'internalIntegrations',
        `/organizations/${organization.slug}/sentry-apps/`,
        {query: {status: 'internal'}},
      ],
    ],
  });
  const api = useApi();
  const [token, setToken] = useState(null);
  const [integrations, setIntegrations] = useState<SentryApp[]>([]);
  const [selectedItem, selectItem] = useState<Pick<Item, 'label' | 'value'> | null>(null);

  useEffect(() => {
    if (!isLoading && data.internalIntegrations) {
      setIntegrations(data.internalIntegrations);
    }
  }, [isLoading, data.internalIntegrations]);
  useEffect(() => {
    trackAdvancedAnalyticsEvent('releases.quickstart_viewed', {
      organization,
      project_id: project.id,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const trackQuickstartCopy = useCallback(() => {
    trackAdvancedAnalyticsEvent('releases.quickstart_copied', {
      organization,
      project_id: project.id,
    });
  }, [organization, project]);

  const trackQuickstartCreatedIntegration = useCallback(
    (integration: SentryApp) => {
      trackAdvancedAnalyticsEvent('releases.quickstart_create_integration.success', {
        organization,
        project_id: project.id,
        integration_uuid: integration.uuid,
      });
    },
    [organization, project]
  );

  const trackCreateIntegrationModalClose = useCallback(() => {
    trackAdvancedAnalyticsEvent('releases.quickstart_create_integration_modal.close', {
      organization,
      project_id: project.id,
    });
  }, [organization, project.id]);

  const fetchToken = async sentryAppSlug => {
    const tokens = await api.requestPromise(`/sentry-apps/${sentryAppSlug}/api-tokens/`);
    if (!tokens.length) {
      const newToken = await generateToken(sentryAppSlug);
      return setToken(newToken);
    }
    return setToken(tokens[0].token);
  };

  const generateToken = async (sentryAppSlug: string) => {
    const newToken = await api.requestPromise(
      `/sentry-apps/${sentryAppSlug}/api-tokens/`,
      {
        method: 'POST',
      }
    );
    return newToken.token;
  };

  const handleCopy = async () => {
    if (!token || !selectedItem) {
      addErrorMessage(t('Select an integration for your auth token!'));
      return;
    }
    const current_text = `
      # Install the cli
      curl -sL https://sentry.io/get-cli/ | SENTRY_CLI_VERSION="2.2.0" bash
      # Setup configuration values
      SENTRY_AUTH_TOKEN=${token} # From internal integration: ${selectedItem.value.name}
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

  const renderIntegrationNode = (integration: SentryApp) => {
    return {
      value: {slug: integration.slug, name: integration.name},
      searchKey: `${integration.name}`,
      label: (
        <MenuItemWrapper data-test-id="integration-option" key={integration.uuid}>
          <Label>{integration.name}</Label>
        </MenuItemWrapper>
      ),
    };
  };
  return renderComponent(
    <Panel>
      <Container>
        <StyledPageHeader>
          <h3>{t('Set up Releases')}</h3>

          <Button priority="default" size="sm" href={releasesSetupUrl} external>
            {t('Full Documentation')}
          </Button>
        </StyledPageHeader>

        <p>
          {t(
            'Find which release caused an issue, apply source maps, and get notified about your deploys.'
          )}
        </p>
        <p>
          {t(
            'Add the following commands to your CI config when you deploy your application.'
          )}
        </p>

        <CodeBlock>
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
            <StyledDropdownAutoComplete
              minWidth={300}
              maxHeight={400}
              onOpen={e => {
                // This can be called multiple times and does not always have `event`
                e?.stopPropagation();
              }}
              items={[
                {
                  label: <GroupHeader>{t('Available Integrations')}</GroupHeader>,
                  id: 'available-integrations',
                  items: (integrations || []).map(renderIntegrationNode),
                },
              ]}
              alignMenu="left"
              onSelect={({label, value}) => {
                selectItem({label, value});
                fetchToken(value.slug);
              }}
              itemSize="small"
              searchPlaceholder={t('Select Internal Integration')}
              menuFooter={
                <Access access={['org:integrations']}>
                  {({hasAccess}) => (
                    <Tooltip
                      title={t(
                        'You must be an organization owner, manager or admin to create an integration.'
                      )}
                      disabled={hasAccess}
                    >
                      <CreateIntegrationLink
                        to=""
                        data-test-id="create-release-integration"
                        disabled={!hasAccess}
                        onClick={() =>
                          openCreateReleaseIntegration({
                            organization,
                            project,
                            onCreateSuccess: (integration: SentryApp) => {
                              setIntegrations([integration, ...integrations]);
                              const {label, value} = renderIntegrationNode(integration);
                              selectItem({
                                label,
                                value,
                              });
                              fetchToken(value.slug);
                              trackQuickstartCreatedIntegration(integration);
                            },
                            onCancel: () => {
                              trackCreateIntegrationModalClose();
                            },
                          })
                        }
                      >
                        <MenuItemFooterWrapper>
                          <IconContainer>
                            <IconAdd color="activeText" isCircled size="14px" />
                          </IconContainer>
                          <Label>{t('Create New Integration')}</Label>
                        </MenuItemFooterWrapper>
                      </CreateIntegrationLink>
                    </Tooltip>
                  )}
                </Access>
              }
              disableLabelPadding
              emptyHidesInput
            >
              {() => {
                return token && selectedItem ? (
                  <span style={{display: 'flex'}}>
                    <Bash>{token}</Bash>
                    <Comment>{` # From internal integration: ${selectedItem.value.name} `}</Comment>
                  </span>
                ) : (
                  <Bash style={{color: '#7cc5c4'}}>{'<click-here-for-your-token>'}</Bash>
                );
              }}
            </StyledDropdownAutoComplete>
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

const StyledDropdownAutoComplete = styled(DropdownAutoComplete)`
  font-family: ${p => p.theme.text.family};
  border: none;
  border-radius: 4px;
  width: 300px;
`;
const GroupHeader = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  font-family: ${p => p.theme.text.family};
  font-weight: 600;
  margin: ${space(1)} 0;
  color: ${p => p.theme.subText};
  line-height: ${p => p.theme.fontSizeSmall};
  text-align: left;
`;
const CreateIntegrationLink = styled(Link)`
  color: ${p => (p.disabled ? p.theme.disabled : p.theme.textColor)};
`;

const MenuItemWrapper = styled('div')<{
  disabled?: boolean;
  py?: number;
}>`
  cursor: ${p => (p.disabled ? 'not-allowed' : 'pointer')};
  display: flex;
  align-items: center;
  font-family: ${p => p.theme.text.family};
  font-size: 13px;
  ${p =>
    typeof p.py !== 'undefined' &&
    `
      padding-top: ${p.py};
      padding-bottom: ${p.py};
    `};
`;

const MenuItemFooterWrapper = styled(MenuItemWrapper)`
  padding: ${space(0.25)} ${space(1)};
  border-top: 1px solid ${p => p.theme.innerBorder};
  background-color: ${p => p.theme.tag.highlight.background};
  color: ${p => p.theme.active};
  :hover {
    color: ${p => p.theme.activeHover};
    svg {
      fill: ${p => p.theme.activeHover};
    }
  }
`;

const IconContainer = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
`;

const Label = styled(TextOverflow)`
  margin-left: 6px;
`;

export default ReleasesPromo;
