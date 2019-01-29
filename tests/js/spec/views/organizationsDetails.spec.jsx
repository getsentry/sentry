import React from 'react';
import {mount} from 'enzyme';

import OrganizationDetails from 'app/views/organizationDetails';

describe('OrganizationDetails', function() {
  beforeEach(function() {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/broadcasts/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/environments/',
      body: [],
    });
  });

  describe('render()', function() {
    describe('pending deletion', () => {
      it('should render a restoration prompt', async function() {
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
        let tree = mount(
          <OrganizationDetails params={{orgId: 'org-slug'}} location={{}} />,
          TestStubs.routerContext()
        );
        await tick();
        await tick();
        tree.update();
        expect(tree.text()).toContain('Deletion Scheduled');
        expect(tree).toMatchSnapshot();
      });

      it('should render a restoration prompt without action for members', async function() {
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
        let tree = mount(
          <OrganizationDetails params={{orgId: 'org-slug'}} location={{}} />,
          TestStubs.routerContext()
        );
        await tick();
        await tick();
        tree.update();
        expect(tree.text()).toContain('Deletion Scheduled');
        expect(tree).toMatchSnapshot();
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

      it('should render a deletion in progress prompt', async function() {
        let tree = mount(
          <OrganizationDetails params={{orgId: 'org-slug'}} location={{}} />
        );
        await tick();
        await tick();
        tree.update();
        expect(tree.text()).toContain(
          'The org-slug organization is currently in the process of being deleted from Sentry'
        );
        expect(tree).toMatchSnapshot();
      });
    });
  });
});
