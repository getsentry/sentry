import {mountWithTheme} from 'sentry-test/enzyme';

import {Client} from 'app/api';
import IntegrationDetailedView from 'app/views/organizationIntegrations/integrationDetailedView';

const mockResponse = mocks => {
  mocks.forEach(([url, body]) =>
    Client.addMockResponse({
      url,
      body,
    })
  );
};

describe('IntegrationDetailedView', function () {
  const org = TestStubs.Organization();
  const routerContext = TestStubs.routerContext();
  let wrapper;

  beforeEach(() => {
    Client.clearMockResponses();

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
                  'https://github.com/getsentry/sentry/issues/new?title=Bitbucket%20Integration:%20&labels=Component%3A%20Integrations',
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
        `/organizations/${org.slug}/integrations/?provider_key=bitbucket`,
        [
          {
            accountType: null,
            configData: {},
            configOrganization: [],
            domainName: 'bitbucket.org/%7Bfb715533-bbd7-4666-aa57-01dc93dd9cc0%7D',
            icon:
              'https://secure.gravatar.com/avatar/8b4cb68e40b74c90427d8262256bd1c8?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FNN-0.png',
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

    wrapper = mountWithTheme(
      <IntegrationDetailedView
        params={{integrationSlug: 'bitbucket', orgId: org.slug}}
        location={{query: {}}}
      />,
      routerContext
    );
  });
  it('shows the Integration name and install status', async function () {
    expect(wrapper.find('Name').props().children).toEqual('Bitbucket');
    expect(wrapper.find('IntegrationStatus').props().status).toEqual('Installed');
  });
  it('shows the Add Installation button', async function () {
    expect(wrapper.find('AddIntegrationButton').props().disabled).toEqual(false);
  });
  it('view configurations', async function () {
    wrapper = mountWithTheme(
      <IntegrationDetailedView
        params={{integrationSlug: 'bitbucket', orgId: org.slug}}
        location={{query: {tab: 'configurations'}}}
      />,
      routerContext
    );
    expect(wrapper.find('InstallWrapper')).toHaveLength(1);
  });
});
