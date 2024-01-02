import selectEvent from 'react-select-event';
import pick from 'lodash/pick';
import {Organization} from 'sentry-fixture/organization';
import {RouteComponentPropsFixture} from 'sentry-fixture/routeComponentPropsFixture';
import {SentryApp} from 'sentry-fixture/sentryApp';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import type {Organization as TOrganization} from 'sentry/types';
import SentryAppExternalInstallation from 'sentry/views/sentryAppExternalInstallation';

describe('SentryAppExternalInstallation', () => {
  let sentryApp: ReturnType<typeof SentryApp>,
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

    org1 = Organization({
      slug: 'org1',
      name: 'Organization 1',
    });

    org2 = Organization({
      slug: 'org2',
      name: 'Organization 2',
    });

    org1Lite = pick(org1, ['slug', 'name', 'id']);
    org2Lite = pick(org2, ['slug', 'name', 'id']);

    sentryApp = SentryApp({
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
    });

    it('sets the org automatically', () => {
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
      expect(
        screen.getByText(
          textWithMarkupMatcher(
            'You are installing Sample App for organization Organization 1'
          )
        )
      ).toBeInTheDocument();
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

      await userEvent.click(await screen.findByTestId('install'));

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
    });

    it('renders org dropdown', () => {
      render(
        <SentryAppExternalInstallation
          {...RouteComponentPropsFixture()}
          params={{sentryAppSlug: sentryApp.slug}}
        />
      );

      expect(getAppMock).toHaveBeenCalled();
      expect(getOrgsMock).toHaveBeenCalled();
      expect(screen.getByText('Select an organization')).toBeInTheDocument();
    });

    it('selecting org from dropdown loads the org through the API', async () => {
      getOrgMock = MockApiClient.addMockResponse({
        url: `/organizations/${org2.slug}/`,
        body: org2,
      });

      getInstallationsMock = MockApiClient.addMockResponse({
        url: `/organizations/${org2.slug}/sentry-app-installations/`,
        body: [],
      });

      render(
        <SentryAppExternalInstallation
          {...RouteComponentPropsFixture()}
          params={{sentryAppSlug: sentryApp.slug}}
        />
      );

      await selectEvent.select(screen.getByText('Select an organization'), 'org2');

      expect(getOrgMock).toHaveBeenCalledTimes(1);
      expect(getOrgMock).toHaveBeenLastCalledWith(
        '/organizations/org2/',
        expect.anything()
      );
      expect(getInstallationsMock).toHaveBeenCalled();
      expect(getFeaturesMock).toHaveBeenCalled();

      await waitFor(() => expect(screen.getByTestId('install')).toBeEnabled());
    });
  });
});
