import {Project as ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import OrganizationsStore from 'sentry/stores/organizationsStore';
import {OrgAuthToken} from 'sentry/types';
import {OrganizationAuthTokensAuthTokenRow} from 'sentry/views/settings/organizationAuthTokens/authTokenRow';

describe('OrganizationAuthTokensAuthTokenRow', function () {
  const {organization, router} = initializeOrg();

  const revokeToken = jest.fn();
  const token: OrgAuthToken = {
    id: '1',
    name: 'My Token',
    tokenLastCharacters: 'XYZ1',
    dateCreated: new Date('2023-01-01T00:00:00.000Z'),
    scopes: ['org:read'],
  };

  const defaultProps = {
    organization,
    isRevoking: false,
    token,
    revokeToken,
    projectLastUsed: undefined,
    router,
    location: router.location,
    params: {orgId: organization.slug},
    routes: router.routes,
    route: {},
    routeParams: router.params,
  };

  beforeEach(function () {
    OrganizationsStore.addOrReplace(organization);
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('shows token without last used information', function () {
    render(<OrganizationAuthTokensAuthTokenRow {...defaultProps} />);

    expect(screen.getByLabelText('Token preview')).toHaveTextContent(
      'sntrys_************XYZ1'
    );
    expect(screen.getByText('never used')).toBeInTheDocument();
    expect(screen.getByText('My Token')).toBeInTheDocument();
  });

  describe('last used info', function () {
    it('shows full last used info', function () {
      const props = {
        ...defaultProps,
        projectLastUsed: ProjectFixture(),
        token: {
          ...token,
          dateLastUsed: new Date(),
        },
      };

      render(<OrganizationAuthTokensAuthTokenRow {...props} />);

      expect(screen.getByLabelText('Token preview')).toHaveTextContent(
        'sntrys_************XYZ1'
      );
      expect(
        screen.getByText(
          textWithMarkupMatcher('a few seconds ago in project Project Name')
        )
      ).toBeInTheDocument();
      expect(screen.getByText('My Token')).toBeInTheDocument();
    });

    it('shows last used project only', function () {
      const props = {
        ...defaultProps,
        projectLastUsed: ProjectFixture(),
        token: {
          ...token,
        },
      };

      render(<OrganizationAuthTokensAuthTokenRow {...props} />);

      expect(screen.getByLabelText('Token preview')).toHaveTextContent(
        'sntrys_************XYZ1'
      );
      expect(
        screen.getByText(textWithMarkupMatcher('in project Project Name'))
      ).toBeInTheDocument();
      expect(screen.getByText('My Token')).toBeInTheDocument();
    });

    it('shows last used date only', function () {
      const props = {
        ...defaultProps,
        token: {
          ...token,
          dateLastUsed: new Date(),
        },
      };

      render(<OrganizationAuthTokensAuthTokenRow {...props} />);

      expect(screen.getByLabelText('Token preview')).toHaveTextContent(
        'sntrys_************XYZ1'
      );
      expect(
        screen.getByText(textWithMarkupMatcher('a few seconds ago'))
      ).toBeInTheDocument();
      expect(screen.getByText('My Token')).toBeInTheDocument();
    });
  });

  describe('revoking', function () {
    it('does not allow to revoke without access', function () {
      const props = {
        ...defaultProps,
        revokeToken: undefined,
      };

      render(<OrganizationAuthTokensAuthTokenRow {...props} />);

      expect(screen.getByRole('button', {name: 'Revoke My Token'})).toBeDisabled();
    });

    it('allows to revoke', async function () {
      render(<OrganizationAuthTokensAuthTokenRow {...defaultProps} />);
      renderGlobalModal();

      expect(screen.getByRole('button', {name: 'Revoke My Token'})).toBeEnabled();

      await userEvent.click(screen.getByRole('button', {name: 'Revoke My Token'}));
      // Confirm modal
      await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

      expect(revokeToken).toHaveBeenCalledWith(token);
    });

    it('does not allow to revoke while revoking in progress', function () {
      const props = {
        ...defaultProps,
        isRevoking: true,
      };

      render(<OrganizationAuthTokensAuthTokenRow {...props} />);

      expect(screen.getByRole('button', {name: 'Revoke My Token'})).toBeDisabled();
    });
  });
});
