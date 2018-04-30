import React from 'react';
import {render} from 'enzyme';

import {Client} from 'app/api';
import OrganizationDetails from 'app/views/organizationDetails';

describe('OrganizationDetails', function() {
  beforeEach(function() {
    Client.clearMockResponses();
  });

  describe('render()', function() {
    describe('pending deletion', () => {
      it('should render a restoration prompt', function() {
        Client.addMockResponse({
          url: '/organizations/org-slug/',
          body: TestStubs.Organization({
            slug: 'org-slug',
            status: {
              id: 'pending_deletion',
              name: 'pending deletion',
            },
          }),
        });
        let tree = render(
          <OrganizationDetails params={{orgId: 'org-slug'}} />,
          TestStubs.routerContext()
        );
        expect(tree).toMatchSnapshot();
      });

      it('should render a restoration prompt without action for members', function() {
        Client.addMockResponse({
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
        let tree = render(
          <OrganizationDetails params={{orgId: 'org-slug'}} />,
          TestStubs.routerContext()
        );
        expect(tree).toMatchSnapshot();
      });
    });

    describe('deletion in progress', () => {
      beforeEach(() => {
        Client.addMockResponse({
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

      it('should render a deletion in progress prompt', function() {
        let tree = render(
          <OrganizationDetails params={{orgId: 'org-slug'}} />,
          TestStubs.routerContext()
        );
        expect(tree).toMatchSnapshot();
      });
    });
  });
});
