import {render, screen} from 'sentry-test/reactTestingLibrary';

import IntegrationDetailedView from 'sentry/views/settings/organizationIntegrations/integrationDetailedView';

const mockResponse = mocks => {
  mocks.forEach(([url, body]) =>
    MockApiClient.addMockResponse({
      url,
      body,
    })
  );
};

describe('IntegrationDetailedView', function () {
  const org = TestStubs.Organization({
    access: ['org:integrations'],
  });

  beforeEach(() => {
    MockApiClient.clearMockResponses();

    mockResponse([
      [
        `/organizations/${org.slug}/config/integrations/?provider_key=bitbucket`,
        {
          providers: [
            {
              canAdd: true,
              canDisable: false,
              features: ['commits', 'issue-basic'],
              key: 'bitbucket',

              metadata: {
                aspects: {},
                author: 'The Sentry Team',
                description:
                  'Connect your Sentry organization to Bitbucket, enabling the following features:',

                features: [],
                issue_url:
                  'https://github.com/getsentry/sentry/issues/new?template=bug.yml&title=Bitbucket%20Integration:%20&labels=Component%3A%20Integrations',
                noun: 'Installation',
                source_url:
                  'https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/bitbucket',
              },
              name: 'Bitbucket',

              setupDialog: {
                height: 600,
                url: '/organizations/sentry/integrations/bitbucket/setup/',
                width: 600,
              },
              slug: 'bitbucket',
            },
          ],
        },
      ],
      [
        `/organizations/${org.slug}/integrations/?provider_key=bitbucket&includeConfig=0`,
        [
          {
            accountType: null,
            configData: {},
            configOrganization: [],
            domainName: 'bitbucket.org/%7Bfb715533-bbd7-4666-aa57-01dc93dd9cc0%7D',
            icon: 'https://secure.gravatar.com/avatar/8b4cb68e40b74c90427d8262256bd1c8?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FNN-0.png',
            id: '4',
            name: '{fb715533-bbd7-4666-aa57-01dc93dd9cc0}',
            provider: {
              aspects: {},
              canAdd: true,
              canDisable: false,
              features: ['commits', 'issue-basic'],
              key: 'bitbucket',
              name: 'Bitbucket',
              slug: 'bitbucket',
            },
            status: 'active',
          },
        ],
      ],
    ]);
  });

  it('shows integration name, status, and install button', function () {
    render(
      <IntegrationDetailedView
        params={{integrationSlug: 'bitbucket', orgId: org.slug}}
        location={{query: {}}}
      />
    );
    expect(screen.getByText('Bitbucket')).toBeInTheDocument();
    expect(screen.getByText('Installed')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Add integration'})).toBeEnabled();
  });

  it('view configurations', function () {
    render(
      <IntegrationDetailedView
        params={{integrationSlug: 'bitbucket', orgId: org.slug}}
        location={{query: {tab: 'configurations'}}}
      />
    );

    expect(screen.getByTestId('integration-name')).toHaveTextContent(
      '{fb715533-bbd7-4666-aa57-01dc93dd9cc0}'
    );
    expect(screen.getByRole('button', {name: 'Configure'})).toBeEnabled();
  });

  it('disables configure for members without access', function () {
    render(
      <IntegrationDetailedView
        params={{integrationSlug: 'bitbucket', orgId: org.slug}}
        location={{query: {tab: 'configurations'}}}
        organization={TestStubs.Organization({access: ['org:read']})}
      />
    );

    expect(screen.getByRole('button', {name: 'Configure'})).toBeDisabled();
  });

  it('allows members to configure github/gitlab', function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/config/integrations/?provider_key=github`,
      body: {
        providers: [TestStubs.GitHubIntegrationProvider()],
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/integrations/?provider_key=github&includeConfig=0`,
      body: [
        {
          accountType: null,
          configData: {},
          configOrganization: [],
          domainName: 'github.com/%7Bfb715533-bbd7-4666-aa57-01dc93dd9cc0%7D',
          icon: 'https://secure.gravatar.com/avatar/8b4cb68e40b74c90427d8262256bd1c8?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FNN-0.png',
          id: '4',
          name: '{fb715533-bbd7-4666-aa57-01dc93dd9cc0}',
          provider: {
            aspects: {},
            canAdd: true,
            canDisable: false,
            features: ['commits', 'issue-basic'],
            key: 'github',
            name: 'GitHub',
            slug: 'github',
          },
          status: 'active',
        },
      ],
    });

    render(
      <IntegrationDetailedView
        params={{integrationSlug: 'github', orgId: org.slug}}
        location={{query: {tab: 'configurations'}}}
        organization={TestStubs.Organization({access: ['org:read']})}
      />
    );

    expect(screen.getByRole('button', {name: 'Configure'})).toBeEnabled();
  });
});
