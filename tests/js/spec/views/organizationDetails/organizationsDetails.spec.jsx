import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import OrganizationDetails, {
  LightWeightOrganizationDetails,
} from 'app/views/organizationDetails';
import OrganizationStore from 'app/stores/organizationStore';
import ProjectsStore from 'app/stores/projectsStore';

let wrapper;

describe('OrganizationDetails', function () {
  beforeEach(async function () {
    OrganizationStore.reset();
    // wait for store reset changes to propagate
    await tick();

    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/broadcasts/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/environments/',
      body: [],
    });
  });

  afterEach(function () {
    // necessary to unsubscribe successfully from org store
    wrapper.unmount();
  });

  describe('render()', function () {
    describe('pending deletion', () => {
      it('should render a restoration prompt', async function () {
        MockApiClient.addMockResponse({
          url: '/organizations/org-slug/',
          body: TestStubs.Organization({
            slug: 'org-slug',
            status: {
              id: 'pending_deletion',
              name: 'pending deletion',
            },
          }),
        });
        wrapper = mountWithTheme(
          <OrganizationDetails params={{orgId: 'org-slug'}} location={{}} routes={[]} />,
          TestStubs.routerContext()
        );
        await tick();
        await tick();
        wrapper.update();
        expect(wrapper.text()).toContain('Deletion Scheduled');
        expect(wrapper.text()).toContain(
          'Would you like to cancel this process and restore the organization back to the original state?'
        );
        expect(wrapper.find('button[aria-label="Restore Organization"]')).toHaveLength(1);
      });
      it('should render a restoration prompt without action for members', async function () {
        MockApiClient.addMockResponse({
          url: '/organizations/org-slug/',
          body: TestStubs.Organization({
            slug: 'org-slug',
            access: [],
            status: {
              id: 'pending_deletion',
              name: 'pending deletion',
            },
          }),
        });
        wrapper = mountWithTheme(
          <OrganizationDetails params={{orgId: 'org-slug'}} location={{}} routes={[]} />,
          TestStubs.routerContext()
        );
        await tick();
        await tick();
        wrapper.update();
        expect(wrapper.text()).toContain(
          [
            'The org-slug organization is currently scheduled for deletion.',
            'If this is a mistake, contact an organization owner and ask them to restore this organization.',
          ].join('')
        );
        expect(wrapper.find('button[aria-label="Restore Organization"]')).toHaveLength(0);
      });
    });

    describe('deletion in progress', () => {
      beforeEach(() => {
        MockApiClient.addMockResponse({
          url: '/organizations/org-slug/',
          body: TestStubs.Organization({
            slug: 'org-slug',
            status: {
              id: 'deletion_in_progress',
              name: 'deletion in progress',
            },
          }),
        });
      });

      it('should render a deletion in progress prompt', async function () {
        wrapper = mountWithTheme(
          <OrganizationDetails params={{orgId: 'org-slug'}} location={{}} routes={[]} />,
          TestStubs.routerContext()
        );
        await tick();
        await tick();
        wrapper.update();
        expect(wrapper.text()).toContain(
          'The org-slug organization is currently in the process of being deleted from Sentry'
        );
        expect(wrapper.find('button[aria-label="Restore Organization"]')).toHaveLength(0);
      });
    });
  });
  it('can render a lightweight version of itself and fetches teams', async function () {
    ProjectsStore.reset();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/',
      body: TestStubs.Organization({
        slug: 'org-slug',
      }),
    });
    const getTeamsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/teams/',
      body: [TestStubs.Team()],
    });
    const getProjectsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [TestStubs.Project()],
    });
    wrapper = mountWithTheme(
      <LightWeightOrganizationDetails
        params={{orgId: 'org-slug'}}
        location={{}}
        routes={[]}
        includeSidebar={false}
      >
        {null}
      </LightWeightOrganizationDetails>,
      TestStubs.routerContext()
    );
    await tick();
    await tick();
    await tick();
    wrapper.update();
    expect(getTeamsMock).toHaveBeenCalled();
    expect(getProjectsMock).toHaveBeenCalled();
    expect(wrapper.find('OrganizationContext').prop('detailed')).toBe(false);
  });
});
