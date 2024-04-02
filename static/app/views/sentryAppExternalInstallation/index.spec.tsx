import pick from 'lodash/pick';
import {ConfigFixture} from 'sentry-fixture/config';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouteComponentPropsFixture} from 'sentry-fixture/routeComponentPropsFixture';
import {SentryAppFixture} from 'sentry-fixture/sentryApp';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import ConfigStore from 'sentry/stores/configStore';
import type {Organization as TOrganization} from 'sentry/types';
import {generateOrgSlugUrl} from 'sentry/utils';
import SentryAppExternalInstallation from 'sentry/views/sentryAppExternalInstallation';

describe('SentryAppExternalInstallation', () => {
  let sentryApp: ReturnType<typeof SentryAppFixture>,
    getOrgsMock: ReturnType<typeof MockApiClient.addMockResponse>,
    getOrgMock: ReturnType<typeof MockApiClient.addMockResponse>,
    getAppMock: ReturnType<typeof MockApiClient.addMockResponse>,
    getInstallationsMock: ReturnType<typeof MockApiClient.addMockResponse>,
    getFeaturesMock: ReturnType<typeof MockApiClient.addMockResponse>,
    org1: TOrganization,
    org1Lite: Pick<TOrganization, 'slug' | 'name' | 'id'>,
    org2: TOrganization,
    org2Lite: Pick<TOrganization, 'slug' | 'name' | 'id'>;

  beforeEach(() => {
    MockApiClient.clearMockResponses();

    org1 = OrganizationFixture({
      slug: 'org1',
      name: 'Organization 1',
    });

    org2 = OrganizationFixture({
      slug: 'org2',
      name: 'Organization 2',
    });

    org1Lite = pick(org1, ['slug', 'name', 'id']);
    org2Lite = pick(org2, ['slug', 'name', 'id']);

    sentryApp = SentryAppFixture({
      status: 'published',
      redirectUrl: 'https://google.com',
    });

    getAppMock = MockApiClient.addMockResponse({
      url: `/sentry-apps/${sentryApp.slug}/`,
      body: sentryApp,
    });

    getFeaturesMock = MockApiClient.addMockResponse({
      url: `/sentry-apps/${sentryApp.slug}/features/`,
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/sentry-apps/${sentryApp.slug}/interaction/`,
      method: 'POST',
      statusCode: 200,
      body: {},
    });
  });

  describe('single organization', () => {
    beforeEach(() => {
      getOrgsMock = MockApiClient.addMockResponse({
        url: '/organizations/',
        body: [org1Lite],
      });

      getOrgMock = MockApiClient.addMockResponse({
        url: `/organizations/${org1.slug}/`,
        body: org1,
      });

      getInstallationsMock = MockApiClient.addMockResponse({
        url: `/organizations/${org1.slug}/sentry-app-installations/`,
        body: [],
      });

      window.__initialData = ConfigFixture({
        customerDomain: {
          subdomain: 'org1',
          organizationUrl: 'https://org1.sentry.io',
          sentryUrl: 'https://sentry.io',
        },
        links: {
          ...(window.__initialData?.links ?? {}),
          sentryUrl: 'https://sentry.io',
        },
      });
      ConfigStore.loadInitialData(window.__initialData);
    });

    it('sets the org automatically', async () => {
      render(
        <SentryAppExternalInstallation
          {...RouteComponentPropsFixture()}
          params={{sentryAppSlug: sentryApp.slug}}
        />
      );

      expect(
        await screen.findByText(
          textWithMarkupMatcher(
            'You are installing Sample App for organization Organization 1'
          )
        )
      ).toBeInTheDocument();
      expect(getAppMock).toHaveBeenCalled();
      expect(getOrgsMock).toHaveBeenCalled();
      expect(getOrgMock).toHaveBeenCalled();
      expect(getInstallationsMock).toHaveBeenCalled();
      expect(screen.queryByText('Select an organization')).not.toBeInTheDocument();
    });

    it('installs and redirects', async () => {
      const installUrl = `/organizations/${org1.slug}/sentry-app-installations/`;
      const install = {
        uuid: 'fake-id',
        code: 'some-code',
      };
      const installMock = MockApiClient.addMockResponse({
        url: installUrl,
        method: 'POST',
        body: install,
      });

      render(
        <SentryAppExternalInstallation
          {...RouteComponentPropsFixture()}
          params={{sentryAppSlug: sentryApp.slug}}
        />
      );

      await userEvent.click(await screen.findByTestId('install')); // failing currently

      expect(installMock).toHaveBeenCalledWith(
        installUrl,
        expect.objectContaining({
          data: {slug: sentryApp.slug},
        })
      );

      await waitFor(() => {
        expect(window.location.assign).toHaveBeenCalledWith(
          `https://google.com/?code=${install.code}&installationId=${install.uuid}&orgSlug=${org1.slug}`
        );
      });

      (window.location.assign as jest.Mock).mockClear();
    });
  });

  describe('multiple organizations', () => {
    beforeEach(() => {
      getOrgsMock = MockApiClient.addMockResponse({
        url: '/organizations/',
        body: [org1Lite, org2Lite],
      });

      getOrgMock = MockApiClient.addMockResponse({
        url: `/organizations/${org1.slug}/`,
        body: org1,
      });

      getInstallationsMock = MockApiClient.addMockResponse({
        url: `/organizations/${org1.slug}/sentry-app-installations/`,
        body: [],
      });

      window.__initialData = ConfigFixture({
        customerDomain: {
          subdomain: 'org1',
          organizationUrl: 'https://org1.sentry.io',
          sentryUrl: 'https://sentry.io',
        },
        links: {
          ...(window.__initialData?.links ?? {}),
          sentryUrl: 'https://sentry.io',
        },
      });
      ConfigStore.loadInitialData(window.__initialData);
    });

    it('sets the org automatically', async () => {
      render(
        <SentryAppExternalInstallation
          {...RouteComponentPropsFixture()}
          params={{sentryAppSlug: sentryApp.slug}}
        />
      );

      expect(getAppMock).toHaveBeenCalled();
      expect(getOrgsMock).toHaveBeenCalled();
      expect(getOrgMock).toHaveBeenCalled();
      expect(getInstallationsMock).toHaveBeenCalled();
      expect(screen.queryByText('Select an organization')).not.toBeInTheDocument();
      await waitFor(() => expect(screen.getByTestId('install')).toBeEnabled());
    });

    it('selecting org changes the url', async () => {
      const preselectedOrg = OrganizationFixture();
      const {routerProps} = initializeOrg({organization: preselectedOrg});

      window.__initialData = ConfigFixture({
        customerDomain: {
          subdomain: 'org1',
          organizationUrl: 'https://org1.sentry.io',
          sentryUrl: 'https://sentry.io',
        },
        links: {
          ...(window.__initialData?.links ?? {}),
          sentryUrl: 'https://sentry.io',
        },
      });
      ConfigStore.loadInitialData(window.__initialData);

      getOrgMock = MockApiClient.addMockResponse({
        url: `/organizations/org1/`,
        body: preselectedOrg,
      });
      getInstallationsMock = MockApiClient.addMockResponse({
        url: `/organizations/${org1.slug}/sentry-app-installations/`,
        body: [],
      });

      render(
        <SentryAppExternalInstallation
          {...routerProps}
          params={{sentryAppSlug: sentryApp.slug}}
        />
      );

      await selectEvent.select(screen.getByRole('textbox'), 'org2');
      expect(window.location.assign).toHaveBeenCalledWith(generateOrgSlugUrl('org2'));
      expect(getFeaturesMock).toHaveBeenCalled();
    });
  });
});
