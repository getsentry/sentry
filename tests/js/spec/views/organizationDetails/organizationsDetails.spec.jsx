import React from 'react';
import {mountWithTheme} from 'sentry-test/enzyme';

import OrganizationDetails from 'app/views/organizationDetails';
import OrganizationStore from 'app/stores/organizationStore';

describe('OrganizationDetails', function() {
  beforeEach(function() {
    OrganizationStore.reset();
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
        const tree = mountWithTheme(
          <OrganizationDetails params={{orgId: 'org-slug'}} location={{}} routes={[]} />,
          TestStubs.routerContext()
        );
        await tick();
        await tick();
        tree.update();
        expect(tree.text()).toContain('Deletion Scheduled');
        expect(tree.text()).toContain(
          'Would you like to cancel this process and restore the organization back to the original state?'
        );
        expect(tree.find('button[aria-label="Restore Organization"]')).toHaveLength(1);
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
        const tree = mountWithTheme(
          <OrganizationDetails params={{orgId: 'org-slug'}} location={{}} routes={[]} />,
          TestStubs.routerContext()
        );
        await tick();
        await tick();
        tree.update();
        expect(tree.text()).toContain(
          [
            'The org-slug organization is currently scheduled for deletion.',
            'If this is a mistake, contact an organization owner and ask them to restore this organization.',
          ].join('')
        );
        expect(tree.find('button[aria-label="Restore Organization"]')).toHaveLength(0);
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
        const tree = mountWithTheme(
          <OrganizationDetails params={{orgId: 'org-slug'}} location={{}} routes={[]} />,
          TestStubs.routerContext()
        );
        await tick();
        await tick();
        tree.update();
        expect(tree.text()).toContain(
          'The org-slug organization is currently in the process of being deleted from Sentry'
        );
        expect(tree.find('button[aria-label="Restore Organization"]')).toHaveLength(0);
      });
    });
  });
});
