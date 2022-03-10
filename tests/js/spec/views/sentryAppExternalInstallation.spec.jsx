import pick from 'lodash/pick';

import {mountWithTheme} from 'sentry-test/enzyme';
import {selectByValue} from 'sentry-test/select-new';

import SentryAppExternalInstallation from 'sentry/views/sentryAppExternalInstallation';

describe('SentryAppExternalInstallation', () => {
  let sentryApp,
    wrapper,
    getOrgsMock,
    getOrgMock,
    getAppMock,
    getInstallationsMock,
    getFeaturesMock,
    getMountedComponent,
    org1,
    org1Lite,
    org2,
    org2Lite;
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    org1 = TestStubs.Organization({
      slug: 'org1',
      name: 'Organization 1',
    });

    org2 = TestStubs.Organization({
      slug: 'org2',
      name: 'Organization 2',
    });

    org1Lite = pick(org1, ['slug', 'name', 'id']);
    org2Lite = pick(org2, ['slug', 'name', 'id']);

    sentryApp = TestStubs.SentryApp({
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

    getMountedComponent = () =>
      mountWithTheme(
        <SentryAppExternalInstallation params={{sentryAppSlug: sentryApp.slug}} />
      );
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
    it('sets the org automatically', async () => {
      wrapper = getMountedComponent();
      await tick();

      expect(getAppMock).toHaveBeenCalled();
      expect(getOrgsMock).toHaveBeenCalled();
      expect(getOrgMock).toHaveBeenCalled();
      expect(getInstallationsMock).toHaveBeenCalled();
      expect(getFeaturesMock).toHaveBeenCalled();
      expect(wrapper.state('organization')).toBe(org1);
      expect(wrapper.find('.Select-multi-value-wrapper')).toHaveLength(0);
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

      wrapper = getMountedComponent();
      await tick();
      wrapper.update();

      const button = wrapper.find('Button[data-test-id="install"]');
      button.simulate('click');
      await tick();

      expect(installMock).toHaveBeenCalledWith(
        installUrl,
        expect.objectContaining({
          data: {slug: sentryApp.slug},
        })
      );

      expect(window.location.assign).toHaveBeenCalledWith(
        `https://google.com/?code=${install.code}&installationId=${install.uuid}&orgSlug=${org1.slug}`
      );
      window.location.assign.mockClear();
    });
  });
  describe('multiple organizations', () => {
    beforeEach(() => {
      getOrgsMock = MockApiClient.addMockResponse({
        url: '/organizations/',
        body: [org1Lite, org2Lite],
      });
    });
    it('renders org dropdown', async () => {
      wrapper = getMountedComponent();
      await tick();

      expect(getAppMock).toHaveBeenCalled();
      expect(getOrgsMock).toHaveBeenCalled();
      expect(wrapper.state('organization')).toBeNull();
      expect(wrapper.find('SelectControl')).toHaveLength(1);
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

      wrapper = getMountedComponent();
      await tick();
      wrapper.update();

      selectByValue(wrapper, 'org2', {control: true});

      await tick();
      wrapper.update();

      expect(wrapper.state('selectedOrgSlug')).toBe(org2.slug);
      expect(wrapper.state('organization')).toBe(org2);
      expect(getOrgMock).toHaveBeenCalled();
      expect(getInstallationsMock).toHaveBeenCalled();
      expect(getFeaturesMock).toHaveBeenCalled();
    });
  });
});
