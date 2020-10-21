import pick from 'lodash/pick';

import {mountWithTheme} from 'sentry-test/enzyme';
import {selectByValue} from 'sentry-test/select-new';

import IntegrationOrganizationLink from 'app/views/integrationOrganizationLink';

describe('IntegrationOrganizationLink', () => {
  let wrapper,
    getOrgsMock,
    getOrgMock,
    getProviderMock,
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

    getOrgsMock = MockApiClient.addMockResponse({
      url: '/organizations/',
      body: [org1Lite, org2Lite],
    });

    getMountedComponent = () =>
      mountWithTheme(
        <IntegrationOrganizationLink params={{integrationSlug: 'vercel'}} />,
        TestStubs.routerContext()
      );
  });

  it('selecting org from dropdown loads the org through the API', async () => {
    getOrgMock = MockApiClient.addMockResponse({
      url: `/organizations/${org2.slug}/`,
      body: org2,
    });

    getProviderMock = MockApiClient.addMockResponse({
      url: `/organizations/${org2.slug}/config/integrations/?provider_key=vercel`,
      body: {providers: [TestStubs.VercelProvider()]},
    });

    wrapper = getMountedComponent();

    expect(getOrgsMock).toHaveBeenCalled();
    expect(getOrgMock).not.toHaveBeenCalled();

    await tick();
    wrapper.update();

    selectByValue(wrapper, org2.slug, {control: true});

    await tick();
    wrapper.update();

    expect(wrapper.state('selectedOrgSlug')).toBe(org2.slug);
    expect(wrapper.state('organization')).toBe(org2);
    expect(getProviderMock).toHaveBeenCalled();
    expect(getOrgMock).toHaveBeenCalled();
  });
});
