import pick from 'lodash/pick';
import {ConfigFixture} from 'sentry-fixture/config';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {VercelProviderFixture} from 'sentry-fixture/vercelIntegration';

import {render, screen} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import ConfigStore from 'sentry/stores/configStore';
import type {Organization} from 'sentry/types/organization';
import {generateOrgSlugUrl} from 'sentry/utils';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import IntegrationOrganizationLink from 'sentry/views/integrationOrganizationLink';

function setupConfigStore(organization: Organization) {
  const defaultConfig = ConfigFixture();
  window.__initialData = {
    ...defaultConfig,
    customerDomain: {
      subdomain: organization.slug,
      organizationUrl: `https://${organization.slug}.sentry.io`,
      sentryUrl: 'https://sentry.io',
    },
    links: {
      ...defaultConfig.links,
      sentryUrl: 'https://sentry.io',
    },
  };
  ConfigStore.loadInitialData(window.__initialData);
}

function teardownConfigStore() {
  window.__initialData = ConfigFixture();
  ConfigStore.loadInitialData(window.__initialData);
}

describe('IntegrationOrganizationLink', () => {
  const org1 = OrganizationFixture({
    slug: 'org1',
    name: 'Organization 1',
  });
  const org2 = OrganizationFixture({
    slug: 'org2',
    name: 'Organization 2',
  });
  let getOrgsMock: jest.Mock;

  const initialRouterConfig = {
    location: {
      pathname: '/extensions/vercel/link/',
    },
    route: '/extensions/:integrationSlug/link/',
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    const org1Lite = pick(org1, ['slug', 'name', 'id']);
    const org2Lite = pick(org2, ['slug', 'name', 'id']);
    getOrgsMock = MockApiClient.addMockResponse({
      url: '/organizations/',
      match: [MockApiClient.matchQuery({include_feature_flags: 1})],
      body: [org1Lite, org2Lite],
    });
  });

  afterEach(() => {
    teardownConfigStore();
  });

  it('selecting org changes the url', async () => {
    const preselectedOrg = OrganizationFixture({slug: 'foobar'});

    setupConfigStore(preselectedOrg);

    const getOrgMock = MockApiClient.addMockResponse({
      url: `/organizations/${preselectedOrg.slug}/`,
      match: [MockApiClient.matchQuery({include_feature_flags: 1})],
      body: preselectedOrg,
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${preselectedOrg.slug}/config/integrations/`,
      match: [MockApiClient.matchQuery({provider_key: 'vercel'})],
      body: {providers: [VercelProviderFixture()]},
    });

    render(<IntegrationOrganizationLink />, {
      initialRouterConfig,
    });
    expect(await screen.findByTestId('loading-indicator')).not.toBeInTheDocument();

    expect(getOrgsMock).toHaveBeenCalled();
    expect(getOrgMock).toHaveBeenCalled();

    // Select organization
    await selectEvent.select(screen.getByRole('textbox'), org2.name);
    expect(testableWindowLocation.assign).toHaveBeenCalledWith(
      generateOrgSlugUrl(org2.slug)
    );
  });
  it('Selecting the same org as the domain allows you to install', async () => {
    setupConfigStore(org2);

    const getProviderMock = MockApiClient.addMockResponse({
      url: `/organizations/${org2.slug}/config/integrations/`,
      match: [MockApiClient.matchQuery({provider_key: 'vercel'})],
      body: {providers: [VercelProviderFixture()]},
    });

    const getOrgMock = MockApiClient.addMockResponse({
      url: `/organizations/${org2.slug}/`,
      match: [MockApiClient.matchQuery({include_feature_flags: 1})],
      body: org2,
    });

    render(<IntegrationOrganizationLink />, {
      initialRouterConfig,
    });
    expect(await screen.findByTestId('loading-indicator')).not.toBeInTheDocument();

    // Select the same organization as the domain
    await selectEvent.select(screen.getByRole('textbox'), org2.name);
    expect(testableWindowLocation.assign).not.toHaveBeenCalled();

    expect(screen.getByRole('button', {name: 'Install Vercel'})).toBeEnabled();
    expect(getProviderMock).toHaveBeenCalled();
    expect(getOrgMock).toHaveBeenCalled();
  });
});
