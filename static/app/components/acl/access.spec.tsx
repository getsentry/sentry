import {Config as ConfigFixture} from 'sentry-fixture/config';
import {Organization} from 'sentry-fixture/organization';
import {Project as ProjectFixture} from 'sentry-fixture/project';
import {RouterContextFixture} from 'sentry-fixture/routerContextFixture';
import {Team} from 'sentry-fixture/team';
import {User} from 'sentry-fixture/user';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import Access from 'sentry/components/acl/access';
import ConfigStore from 'sentry/stores/configStore';

describe('Access', function () {
  const organization = Organization({
    access: ['project:write', 'project:read'],
  });
  const routerContext = RouterContextFixture([{organization}]);

  describe('as render prop', function () {
    const childrenMock = jest.fn().mockReturnValue(null);

    beforeEach(function () {
      childrenMock.mockClear();
    });

    it('has access', function () {
      render(<Access access={['project:write', 'project:read']}>{childrenMock}</Access>, {
        context: routerContext,
        organization,
      });

      expect(childrenMock).toHaveBeenCalledWith({
        hasAccess: true,
        hasSuperuser: false,
      });
    });

    it('has no access', function () {
      render(<Access access={['org:write']}>{childrenMock}</Access>, {
        context: routerContext,
        organization,
      });

      expect(childrenMock).toHaveBeenCalledWith({
        hasAccess: false,
        hasSuperuser: false,
      });
    });

    it('read access from team', function () {
      const org = Organization({access: []});
      const nextRouterContext = RouterContextFixture([{organization: org}]);

      const team1 = Team({access: []});
      render(
        <Access access={['team:admin']} team={team1}>
          {childrenMock}
        </Access>,
        {context: nextRouterContext, organization: org}
      );

      expect(childrenMock).toHaveBeenCalledWith(
        expect.objectContaining({
          hasAccess: false,
          hasSuperuser: false,
        })
      );

      const team2 = Team({
        access: ['team:read', 'team:write', 'team:admin'],
      });
      render(
        <Access access={['team:admin']} team={team2}>
          {childrenMock}
        </Access>,
        {context: nextRouterContext, organization: org}
      );

      expect(childrenMock).toHaveBeenCalledWith(
        expect.objectContaining({
          hasAccess: true,
          hasSuperuser: false,
        })
      );
    });

    it('read access from project', function () {
      const org = Organization({access: []});
      const nextRouterContext = RouterContextFixture([{organization: org}]);

      const proj1 = ProjectFixture({access: []});
      render(
        <Access access={['project:read']} project={proj1}>
          {childrenMock}
        </Access>,
        {context: nextRouterContext, organization: org}
      );

      expect(childrenMock).toHaveBeenCalledWith(
        expect.objectContaining({
          hasAccess: false,
          hasSuperuser: false,
        })
      );

      const proj2 = ProjectFixture({access: ['project:read']});
      render(
        <Access access={['project:read']} project={proj2}>
          {childrenMock}
        </Access>,
        {context: nextRouterContext, organization: org}
      );

      expect(childrenMock).toHaveBeenCalledWith(
        expect.objectContaining({
          hasAccess: true,
          hasSuperuser: false,
        })
      );
    });

    it('handles no org', function () {
      render(<Access access={['org:write']}>{childrenMock}</Access>, {
        context: routerContext,
        organization,
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
      ConfigStore.config = ConfigFixture({
        user: undefined,
      });

      render(<Access>{childrenMock}</Access>, {context: routerContext, organization});

      expect(childrenMock).toHaveBeenCalledWith({
        hasAccess: true,
        hasSuperuser: false,
      });
    });

    it('is superuser', function () {
      ConfigStore.config = ConfigFixture({
        user: User({isSuperuser: true}),
      });

      render(<Access isSuperuser>{childrenMock}</Access>, {
        context: routerContext,
        organization,
      });

      expect(childrenMock).toHaveBeenCalledWith({
        hasAccess: true,
        hasSuperuser: true,
      });
    });

    it('is not superuser', function () {
      ConfigStore.config = ConfigFixture({
        user: User({isSuperuser: false}),
      });

      render(<Access isSuperuser>{childrenMock}</Access>, {
        context: routerContext,
        organization,
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
        {context: routerContext, organization}
      );

      expect(screen.getByText('The Child')).toBeInTheDocument();
    });

    it('has no access', function () {
      render(
        <Access access={['org:write']}>
          <p>The Child</p>
        </Access>,
        {context: routerContext, organization}
      );

      expect(screen.queryByText('The Child')).not.toBeInTheDocument();
    });

    it('has superuser', function () {
      ConfigStore.config = ConfigFixture({
        user: User({isSuperuser: true}),
      });

      render(
        <Access isSuperuser>
          <p>The Child</p>
        </Access>,
        {context: routerContext, organization}
      );

      expect(screen.getByText('The Child')).toBeInTheDocument();
    });

    it('has no superuser', function () {
      ConfigStore.config = ConfigFixture({
        user: User({isSuperuser: false}),
      });

      render(
        <Access isSuperuser>
          <p>The Child</p>
        </Access>,
        {context: routerContext, organization}
      );
      expect(screen.queryByRole('The Child')).not.toBeInTheDocument();
    });
  });
});
