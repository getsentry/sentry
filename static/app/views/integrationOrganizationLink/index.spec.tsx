import pick from 'lodash/pick';
import {ConfigFixture} from 'sentry-fixture/config';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {VercelProviderFixture} from 'sentry-fixture/vercelIntegration';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import ConfigStore from 'sentry/stores/configStore';
import type {Organization} from 'sentry/types/organization';
import {generateOrgSlugUrl} from 'sentry/utils';
import IntegrationOrganizationLink from 'sentry/views/integrationOrganizationLink';

describe('IntegrationOrganizationLink', () => {
  let org1: Organization;
  let org2: Organization;
  let getOrgsMock: jest.Mock;
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    window.location.assign = jest.fn();

    org1 = OrganizationFixture({
      slug: 'org1',
      name: 'Organization 1',
    });

    org2 = OrganizationFixture({
      slug: 'org2',
      name: 'Organization 2',
    });

    const org1Lite = pick(org1, ['slug', 'name', 'id']);
    const org2Lite = pick(org2, ['slug', 'name', 'id']);

    getOrgsMock = MockApiClient.addMockResponse({
      url: '/organizations/?include_feature_flags=1',
      body: [org1Lite, org2Lite],
    });
  });

  it('selecting org changes the url', async () => {
    const preselectedOrg = OrganizationFixture();
    const {routerProps} = initializeOrg({organization: preselectedOrg});

    window.__initialData = ConfigFixture({
      customerDomain: {
        subdomain: 'foobar',
        organizationUrl: 'https://foobar.sentry.io',
        sentryUrl: 'https://sentry.io',
      },
      links: {
        ...(window.__initialData?.links ?? {}),
        sentryUrl: 'https://sentry.io',
      },
    });
    ConfigStore.loadInitialData(window.__initialData);

    const getOrgMock = MockApiClient.addMockResponse({
      url: `/organizations/foobar/`,
      body: preselectedOrg,
    });

    MockApiClient.addMockResponse({
      url: `/organizations/foobar/config/integrations/?provider_key=vercel`,
      body: {providers: [VercelProviderFixture()]},
    });

    render(
      <IntegrationOrganizationLink
        {...routerProps}
        params={{integrationSlug: 'vercel'}}
      />
    );

    expect(getOrgsMock).toHaveBeenCalled();
    expect(getOrgMock).toHaveBeenCalled();

    // Select organization
    await selectEvent.select(screen.getByRole('textbox'), org2.name);
    expect(window.location.assign).toHaveBeenCalledWith(generateOrgSlugUrl(org2.slug));
  });
  it('Selecting the same org as the domain allows you to install', async () => {
    const initialData = initializeOrg({organization: org2});

    window.__initialData = ConfigFixture({
      customerDomain: {
        subdomain: org2.slug,
        organizationUrl: `https://${org2.slug}.sentry.io`,
        sentryUrl: 'https://sentry.io',
      },
      links: {
        ...(window.__initialData?.links ?? {}),
        sentryUrl: 'https://sentry.io',
      },
    });
    ConfigStore.loadInitialData(window.__initialData);

    const getProviderMock = MockApiClient.addMockResponse({
      url: `/organizations/${org2.slug}/config/integrations/?provider_key=vercel`,
      body: {providers: [VercelProviderFixture()]},
    });

    const getOrgMock = MockApiClient.addMockResponse({
      url: `/organizations/${org2.slug}/`,
      body: org2,
    });

    render(
      <IntegrationOrganizationLink
        {...initialData.routerProps}
        params={{integrationSlug: 'vercel'}}
      />,
      {
        router: initialData.router,
      }
    );

    // Select the same organization as the domain
    await selectEvent.select(screen.getByRole('textbox'), org2.name);
    expect(window.location.assign).not.toHaveBeenCalled();

    expect(screen.getByRole('button', {name: 'Install Vercel'})).toBeEnabled();
    expect(getProviderMock).toHaveBeenCalled();
    expect(getOrgMock).toHaveBeenCalled();
  });
});
