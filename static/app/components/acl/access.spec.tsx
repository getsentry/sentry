import {ConfigFixture} from 'sentry-fixture/config';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TeamFixture} from 'sentry-fixture/team';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import Access from 'sentry/components/acl/access';
import ConfigStore from 'sentry/stores/configStore';

describe('Access', () => {
  const organization = OrganizationFixture({
    access: ['project:write', 'project:read'],
  });

  describe('as render prop', () => {
    const childrenMock = jest.fn().mockReturnValue(null);

    beforeEach(() => {
      childrenMock.mockClear();
    });

    it('has access', () => {
      render(<Access access={['project:write', 'project:read']}>{childrenMock}</Access>, {
        organization,
      });

      expect(childrenMock).toHaveBeenCalledWith({
        hasAccess: true,
        hasSuperuser: false,
      });
    });

    it('has no access', () => {
      render(<Access access={['org:write']}>{childrenMock}</Access>, {
        organization,
      });

      expect(childrenMock).toHaveBeenCalledWith({
        hasAccess: false,
        hasSuperuser: false,
      });
    });

    it('read access from team', () => {
      const org = OrganizationFixture({access: []});

      const team1 = TeamFixture({access: []});
      render(
        <Access access={['team:admin']} team={team1}>
          {childrenMock}
        </Access>,
        {organization: org}
      );

      expect(childrenMock).toHaveBeenCalledWith(
        expect.objectContaining({
          hasAccess: false,
          hasSuperuser: false,
        })
      );

      const team2 = TeamFixture({
        access: ['team:read', 'team:write', 'team:admin'],
      });
      render(
        <Access access={['team:admin']} team={team2}>
          {childrenMock}
        </Access>,
        {organization: org}
      );

      expect(childrenMock).toHaveBeenCalledWith(
        expect.objectContaining({
          hasAccess: true,
          hasSuperuser: false,
        })
      );
    });

    it('read access from project', () => {
      const org = OrganizationFixture({access: []});

      const proj1 = ProjectFixture({access: []});
      render(
        <Access access={['project:read']} project={proj1}>
          {childrenMock}
        </Access>,
        {organization: org}
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
        {organization: org}
      );

      expect(childrenMock).toHaveBeenCalledWith(
        expect.objectContaining({
          hasAccess: true,
          hasSuperuser: false,
        })
      );
    });

    it('handles no org', () => {
      render(<Access access={['org:write']}>{childrenMock}</Access>, {
        organization,
      });

      expect(childrenMock).toHaveBeenCalledWith(
        expect.objectContaining({
          hasAccess: false,
          hasSuperuser: false,
        })
      );
    });

    it('handles no user', () => {
      // Regression test for the share sheet.
      ConfigStore.loadInitialData(
        ConfigFixture({
          user: undefined,
        })
      );

      render(<Access access={[]}>{childrenMock}</Access>, {organization});

      expect(childrenMock).toHaveBeenCalledWith({
        hasAccess: true,
        hasSuperuser: false,
      });
    });

    it('is superuser', () => {
      ConfigStore.loadInitialData(
        ConfigFixture({
          user: UserFixture({isSuperuser: true}),
        })
      );

      render(
        <Access access={[]} isSuperuser>
          {childrenMock}
        </Access>,
        {
          organization,
        }
      );

      expect(childrenMock).toHaveBeenCalledWith({
        hasAccess: true,
        hasSuperuser: true,
      });
    });

    it('is not superuser', () => {
      ConfigStore.loadInitialData(
        ConfigFixture({
          user: UserFixture({isSuperuser: false}),
        })
      );

      render(
        <Access access={[]} isSuperuser>
          {childrenMock}
        </Access>,
        {
          organization,
        }
      );

      expect(childrenMock).toHaveBeenCalledWith({
        hasAccess: true,
        hasSuperuser: false,
      });
    });
  });

  describe('as React node', () => {
    it('has access', () => {
      render(
        <Access access={['project:write']}>
          <p>The Child</p>
        </Access>,
        {organization}
      );

      expect(screen.getByText('The Child')).toBeInTheDocument();
    });

    it('has no access', () => {
      render(
        <Access access={['org:write']}>
          <p>The Child</p>
        </Access>,
        {organization}
      );

      expect(screen.queryByText('The Child')).not.toBeInTheDocument();
    });

    it('has superuser', () => {
      ConfigStore.loadInitialData(
        ConfigFixture({
          user: UserFixture({isSuperuser: true}),
        })
      );

      render(
        <Access access={[]} isSuperuser>
          <p>The Child</p>
        </Access>,
        {organization}
      );

      expect(screen.getByText('The Child')).toBeInTheDocument();
    });

    it('has no superuser', () => {
      ConfigStore.loadInitialData(
        ConfigFixture({
          user: UserFixture({isSuperuser: false}),
        })
      );

      render(
        <Access access={[]} isSuperuser>
          <p>The Child</p>
        </Access>,
        {organization}
      );
      expect(screen.queryByRole('The Child')).not.toBeInTheDocument();
    });
  });
});
