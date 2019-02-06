import React from 'react';

import {mount} from 'enzyme';
import {OrganizationUserFeedback} from 'app/views/userFeedback/organizationUserFeedback';

describe('OrganizationUserFeedback', function() {
  let organization, routerContext;
  beforeEach(function() {
    const pageLinks =
      '<https://sentry.io/api/0/organizations/sentry/user-feedback/?statsPeriod=14d&cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1", ' +
      '<https://sentry.io/api/0/organizations/sentry/user-feedback/?statsPeriod=14d&cursor=0:100:0>; rel="next"; results="true"; cursor="0:100:0"';

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/user-feedback/',
      body: [TestStubs.UserFeedback()],
      headers: {Link: pageLinks},
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/environments/',
      body: TestStubs.Environments(),
    });

    organization = TestStubs.Organization();
    routerContext = TestStubs.routerContext([
      {
        organization,
        router: {
          ...TestStubs.router(),
          params: {
            orgId: organization.slug,
          },
        },
      },
    ]);
  });

  it('renders', function() {
    const params = {
      organization: TestStubs.Organization({
        features: ['sentry10'],
        projects: [TestStubs.Project({isMember: true})],
      }),
      location: {query: {}, search: ''},
      params: {
        orgId: organization.slug,
      },
    };
    const wrapper = mount(<OrganizationUserFeedback {...params} />, routerContext);

    expect(wrapper).toMatchSnapshot();
  });

  it('no access', function() {
    const params = {
      organization: TestStubs.Organization(),
      location: {query: {}, search: ''},
      params: {
        orgId: 'org-slug',
      },
    };

    const wrapper = mount(
      <OrganizationUserFeedback {...params} />,
      TestStubs.routerContext()
    );

    expect(wrapper.text()).toBe("You don't have access to this feature");
  });
});
