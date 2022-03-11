import {render, screen} from 'sentry-test/reactTestingLibrary';

import Access from 'sentry/components/acl/access';
import ConfigStore from 'sentry/stores/configStore';

describe('Access', function () {
  const organization = TestStubs.Organization({
    access: ['project:write', 'project:read'],
  });
  const routerContext = TestStubs.routerContext([{organization}]);

  describe('as render prop', function () {
    const childrenMock = jest.fn().mockReturnValue(null);

    beforeEach(function () {
      childrenMock.mockClear();
    });

    it('has access when requireAll is false', function () {
      render(
        <Access access={['project:write', 'project:read', 'org:read']} requireAll={false}>
          {childrenMock}
        </Access>,
        {context: routerContext}
      );

      expect(childrenMock).toHaveBeenCalledWith({
        hasAccess: true,
        hasSuperuser: false,
      });
    });

    it('has access', function () {
      render(<Access access={['project:write', 'project:read']}>{childrenMock}</Access>, {
        context: routerContext,
      });

      expect(childrenMock).toHaveBeenCalledWith({
        hasAccess: true,
        hasSuperuser: false,
      });
    });

    it('has no access', function () {
      render(<Access access={['org:write']}>{childrenMock}</Access>, {
        context: routerContext,
      });

      expect(childrenMock).toHaveBeenCalledWith({
        hasAccess: false,
        hasSuperuser: false,
      });
    });

    it('calls render function when no access', function () {
      const noAccessRenderer = jest.fn(() => null);
      render(
        <Access access={['org:write']} renderNoAccessMessage={noAccessRenderer}>
          {childrenMock}
        </Access>,
        {context: routerContext}
      );

      expect(childrenMock).not.toHaveBeenCalled();
      expect(noAccessRenderer).toHaveBeenCalled();
    });

    it('can specify org from props', function () {
      render(
        <Access
          organization={TestStubs.Organization({access: ['org:write']})}
          access={['org:write']}
        >
          {childrenMock}
        </Access>,
        {context: routerContext}
      );

      expect(childrenMock).toHaveBeenCalledWith({
        hasAccess: true,
        hasSuperuser: false,
      });
    });

    it('handles no org/project', function () {
      render(<Access access={['org:write']}>{childrenMock}</Access>, {
        context: routerContext,
      });

      expect(childrenMock).toHaveBeenCalledWith(
        expect.objectContaining({
          hasAccess: false,
          hasSuperuser: false,
        })
      );
    });

    it('handles no user', function () {
      // Regression test for the share sheet.
      ConfigStore.config = {
        user: null,
      };

      render(<Access>{childrenMock}</Access>, {context: routerContext});

      expect(childrenMock).toHaveBeenCalledWith({
        hasAccess: true,
        hasSuperuser: false,
      });
    });

    it('is superuser', function () {
      ConfigStore.config = {
        user: {isSuperuser: true},
      };
      render(<Access isSuperuser>{childrenMock}</Access>, {
        context: routerContext,
      });

      expect(childrenMock).toHaveBeenCalledWith({
        hasAccess: true,
        hasSuperuser: true,
      });
    });

    it('is not superuser', function () {
      ConfigStore.config = {
        user: {isSuperuser: false},
      };
      render(<Access isSuperuser>{childrenMock}</Access>, {
        context: routerContext,
      });

      expect(childrenMock).toHaveBeenCalledWith({
        hasAccess: true,
        hasSuperuser: false,
      });
    });
  });

  describe('as React node', function () {
    it('has access', function () {
      render(
        <Access access={['project:write']}>
          <p>The Child</p>
        </Access>,
        {context: routerContext}
      );

      expect(screen.getByText('The Child')).toBeInTheDocument();
    });

    it('has superuser', function () {
      ConfigStore.config = {
        user: {isSuperuser: true},
      };
      render(
        <Access isSuperuser>
          <p>The Child</p>
        </Access>,
        {context: routerContext}
      );

      expect(screen.getByText('The Child')).toBeInTheDocument();
    });

    it('has no access', function () {
      render(
        <Access access={['org:write']}>
          <p>The Child</p>
        </Access>,
        {context: routerContext}
      );

      expect(screen.queryByText('The Child')).not.toBeInTheDocument();
    });

    it('has no superuser', function () {
      ConfigStore.config = {
        user: {isSuperuser: false},
      };
      render(
        <Access isSuperuser>
          <p>The Child</p>
        </Access>,
        {context: routerContext}
      );
      expect(screen.queryByRole('The Child')).not.toBeInTheDocument();
    });
  });
});
