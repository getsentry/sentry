import {Organization} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import * as indicators from 'sentry/actionCreators/indicator';
import OrganizationsStore from 'sentry/stores/organizationsStore';
import {OrgAuthToken} from 'sentry/types';
import {OrganizationAuthTokensIndex} from 'sentry/views/settings/organizationAuthTokens';

describe('OrganizationAuthTokensIndex', function () {
  const ENDPOINT = '/organizations/org-slug/org-auth-tokens/';
  const PROJECTS_ENDPOINT = '/organizations/org-slug/projects/';
  const {organization, project, router} = initializeOrg();

  const defaultProps = {
    organization,
    router,
    location: router.location,
    params: {orgId: organization.slug},
    routes: router.routes,
    route: {},
    routeParams: router.params,
  };

  let projectsMock: jest.Mock<any>;

  beforeEach(function () {
    OrganizationsStore.addOrReplace(organization);

    projectsMock = MockApiClient.addMockResponse({
      url: PROJECTS_ENDPOINT,
      method: 'GET',
      body: [project],
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('shows tokens', async function () {
    const tokens: OrgAuthToken[] = [
      {
        id: '1',
        name: 'My Token 1',
        tokenLastCharacters: '1234',
        dateCreated: new Date('2023-01-01T00:00:00.000Z'),
        scopes: ['org:read'],
      },
      {
        id: '2',
        name: 'My Token 2',
        tokenLastCharacters: 'ABCD',
        dateCreated: new Date('2023-01-01T00:00:00.000Z'),
        scopes: ['org:read'],
        dateLastUsed: new Date(),
        projectLastUsedId: project.id,
      },
    ];

    const mock = MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'GET',
      body: tokens,
    });

    render(<OrganizationAuthTokensIndex {...defaultProps} />);

    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    // Then list
    expect(
      await screen.findByText(
        textWithMarkupMatcher('a few seconds ago in project Project Name')
      )
    ).toBeInTheDocument();
    expect(screen.getByText('My Token 1')).toBeInTheDocument();
    expect(screen.getByText('My Token 2')).toBeInTheDocument();
    expect(screen.getByText('never used')).toBeInTheDocument();

    expect(screen.queryByTestId('loading-error')).not.toBeInTheDocument();
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();

    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock).toHaveBeenCalledWith(ENDPOINT, expect.objectContaining({method: 'GET'}));
    expect(projectsMock).toHaveBeenCalledTimes(1);
    expect(projectsMock).toHaveBeenCalledWith(
      PROJECTS_ENDPOINT,
      expect.objectContaining({method: 'GET', query: {query: `id:${project.id}`}})
    );
  });

  it('shows unused tokens', async function () {
    const tokens: OrgAuthToken[] = [
      {
        id: '1',
        name: 'My Token 1',
        tokenLastCharacters: '1234',
        dateCreated: new Date('2023-01-01T00:00:00.000Z'),
        scopes: ['org:read'],
      },
      {
        id: '2',
        name: 'My Token 2',
        tokenLastCharacters: 'ABCD',
        dateCreated: new Date('2023-01-01T00:00:00.000Z'),
        scopes: ['org:read'],
      },
    ];

    MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'GET',
      body: tokens,
    });

    render(<OrganizationAuthTokensIndex {...defaultProps} />);

    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    // Then list
    expect(screen.getByText('My Token 1')).toBeInTheDocument();
    expect(screen.getByText('My Token 2')).toBeInTheDocument();
    expect(screen.getAllByText('never used')).toHaveLength(2);
  });

  it('handle error when loading tokens', async function () {
    const mock = MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'GET',
      statusCode: 400,
    });

    render(<OrganizationAuthTokensIndex {...defaultProps} />);

    expect(await screen.findByTestId('loading-error')).toHaveTextContent(
      'Failed to load auth tokens for the organization.'
    );
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();

    expect(mock).toHaveBeenCalledTimes(1);
  });

  it('shows empty state', async function () {
    const tokens: OrgAuthToken[] = [];

    MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'GET',
      body: tokens,
    });

    render(<OrganizationAuthTokensIndex {...defaultProps} />);

    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.queryByTestId('loading-error')).not.toBeInTheDocument();
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
  });

  describe('revoking', function () {
    it('allows to revoke tokens', async function () {
      jest.spyOn(indicators, 'addSuccessMessage');

      const tokens: OrgAuthToken[] = [
        {
          id: '1',
          name: 'My Token 1',
          tokenLastCharacters: '1234',
          dateCreated: new Date('2023-01-01T00:00:00.000Z'),
          scopes: ['org:read'],
        },
        {
          id: '2',
          name: 'My Token 2',
          tokenLastCharacters: 'ABCD',
          dateCreated: new Date('2023-01-01T00:00:00.000Z'),
          scopes: ['org:read'],
        },
        {
          id: '3',
          name: 'My Token 3',
          tokenLastCharacters: 'ABCD',
          dateCreated: new Date('2023-01-01T00:00:00.000Z'),
          scopes: ['org:read'],
        },
      ];

      MockApiClient.addMockResponse({
        url: ENDPOINT,
        method: 'GET',
        body: tokens,
      });

      const deleteMock = MockApiClient.addMockResponse({
        url: `${ENDPOINT}2/`,
        method: 'DELETE',
      });

      render(<OrganizationAuthTokensIndex {...defaultProps} />);
      renderGlobalModal();

      expect(await screen.findByText('My Token 1')).toBeInTheDocument();
      expect(screen.getByText('My Token 2')).toBeInTheDocument();
      expect(screen.getByText('My Token 3')).toBeInTheDocument();

      expect(screen.getByLabelText('Revoke My Token 2')).toBeEnabled();

      await userEvent.click(screen.getByLabelText('Revoke My Token 2'));
      // Confirm modal
      await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

      expect(screen.getByText('My Token 1')).toBeInTheDocument();
      expect(screen.queryByText('My Token 2')).not.toBeInTheDocument();
      expect(screen.getByText('My Token 3')).toBeInTheDocument();

      expect(indicators.addSuccessMessage).toHaveBeenCalledWith(
        'Revoked auth token for the organization.'
      );

      expect(deleteMock).toHaveBeenCalledTimes(1);
    });

    it('handles API error when revoking token', async function () {
      jest.spyOn(indicators, 'addErrorMessage');

      const tokens: OrgAuthToken[] = [
        {
          id: '1',
          name: 'My Token 1',
          tokenLastCharacters: '1234',
          dateCreated: new Date('2023-01-01T00:00:00.000Z'),
          scopes: ['org:read'],
        },
      ];

      MockApiClient.addMockResponse({
        url: ENDPOINT,
        method: 'GET',
        body: tokens,
      });

      const deleteMock = MockApiClient.addMockResponse({
        url: `${ENDPOINT}1/`,
        method: 'DELETE',
        statusCode: 400,
      });

      render(<OrganizationAuthTokensIndex {...defaultProps} />);
      renderGlobalModal();

      expect(await screen.findByText('My Token 1')).toBeInTheDocument();

      expect(screen.getByLabelText('Revoke My Token 1')).toBeEnabled();

      await userEvent.click(screen.getByLabelText('Revoke My Token 1'));
      // Confirm modal
      await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

      expect(screen.getByText('My Token 1')).toBeInTheDocument();

      expect(indicators.addErrorMessage).toHaveBeenCalledWith(
        'Failed to revoke the auth token for the organization.'
      );

      expect(deleteMock).toHaveBeenCalledTimes(1);
    });

    it('does not allow to revoke without permission', async function () {
      const org = Organization({
        access: ['org:read'],
      });

      const tokens: OrgAuthToken[] = [
        {
          id: '1',
          name: 'My Token 1',
          tokenLastCharacters: '1234',
          dateCreated: new Date('2023-01-01T00:00:00.000Z'),
          scopes: ['org:read'],
        },
      ];

      const props = {
        ...defaultProps,
        organization: org,
      };

      MockApiClient.addMockResponse({
        url: ENDPOINT,
        method: 'GET',
        body: tokens,
      });

      render(<OrganizationAuthTokensIndex {...props} />, {organization: org});

      expect(await screen.findByText('My Token 1')).toBeInTheDocument();

      expect(screen.getByLabelText('Revoke My Token 1')).toBeDisabled();
    });
  });
});
