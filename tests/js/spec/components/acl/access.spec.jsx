import React from 'react';

import {mount} from 'sentry-test/enzyme';

import Access from 'app/components/acl/access';
import ConfigStore from 'app/stores/configStore';

describe('Access', function() {
  const organization = TestStubs.Organization({
    access: ['project:write', 'project:read'],
  });
  const routerContext = TestStubs.routerContext([{organization}]);

  describe('as render prop', function() {
    const childrenMock = jest.fn().mockReturnValue(null);
    beforeEach(function() {
      childrenMock.mockClear();
    });

    it('has access when requireAll is false', function() {
      mount(
        <Access access={['project:write', 'project:read', 'org:read']} requireAll={false}>
          {childrenMock}
        </Access>,
        routerContext
      );

      expect(childrenMock).toHaveBeenCalledWith({
        hasAccess: true,
        hasSuperuser: false,
      });
    });

    it('has access', function() {
      mount(
        <Access access={['project:write', 'project:read']}>{childrenMock}</Access>,
        routerContext
      );

      expect(childrenMock).toHaveBeenCalledWith({
        hasAccess: true,
        hasSuperuser: false,
      });
    });

    it('has no access', function() {
      mount(<Access access={['org:write']}>{childrenMock}</Access>, routerContext);

      expect(childrenMock).toHaveBeenCalledWith({
        hasAccess: false,
        hasSuperuser: false,
      });
    });

    it('calls render function when no access', function() {
      const noAccessRenderer = jest.fn(() => null);
      mount(
        <Access access={['org:write']} renderNoAccessMessage={noAccessRenderer}>
          {childrenMock}
        </Access>,
        routerContext
      );

      expect(childrenMock).not.toHaveBeenCalled();
      expect(noAccessRenderer).toHaveBeenCalled();
    });

    it('can specify org from props', function() {
      mount(
        <Access
          organization={TestStubs.Organization({access: ['org:write']})}
          access={['org:write']}
        >
          {childrenMock}
        </Access>,
        routerContext
      );

      expect(childrenMock).toHaveBeenCalledWith({
        hasAccess: true,
        hasSuperuser: false,
      });
    });

    it('handles no org/project', function() {
      mount(<Access access={['org:write']}>{childrenMock}</Access>, routerContext);

      expect(childrenMock).toHaveBeenCalledWith(
        expect.objectContaining({
          hasAccess: false,
          hasSuperuser: false,
        })
      );
    });

    it('handles no user', function() {
      // Regression test for the share sheet.
      ConfigStore.config = {
        user: null,
      };

      mount(<Access>{childrenMock}</Access>, routerContext);

      expect(childrenMock).toHaveBeenCalledWith({
        hasAccess: true,
        hasSuperuser: false,
      });
    });

    it('is superuser', function() {
      ConfigStore.config = {
        user: {isSuperuser: true},
      };
      mount(<Access isSuperuser>{childrenMock}</Access>, routerContext);

      expect(childrenMock).toHaveBeenCalledWith({
        hasAccess: true,
        hasSuperuser: true,
      });
    });

    it('is not superuser', function() {
      ConfigStore.config = {
        user: {isSuperuser: false},
      };
      mount(<Access isSuperuser>{childrenMock}</Access>, routerContext);

      expect(childrenMock).toHaveBeenCalledWith({
        hasAccess: true,
        hasSuperuser: false,
      });
    });
  });

  describe('as React node', function() {
    let wrapper;

    it('has access', function() {
      wrapper = mount(
        <Access access={['project:write']}>
          <div>The Child</div>
        </Access>,
        routerContext
      );

      expect(wrapper.find('Access div').text()).toBe('The Child');
    });

    it('has superuser', function() {
      ConfigStore.config = {
        user: {isSuperuser: true},
      };
      wrapper = mount(
        <Access isSuperuser>
          <div>The Child</div>
        </Access>,
        routerContext
      );

      expect(wrapper.find('Access div').text()).toBe('The Child');
    });

    it('has no access', function() {
      wrapper = mount(
        <Access access={['org:write']}>
          <div>The Child</div>
        </Access>,
        routerContext
      );

      expect(wrapper.find('Access div')).toHaveLength(0);
    });

    it('has no superuser', function() {
      ConfigStore.config = {
        user: {isSuperuser: false},
      };
      wrapper = mount(
        <Access isSuperuser>
          <div>The Child</div>
        </Access>,
        routerContext
      );
      expect(wrapper.find('Access div')).toHaveLength(0);
    });
  });
});
