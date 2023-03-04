import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import {Client} from 'sentry/api';
import RepositoryRow from 'sentry/components/repositoryRow';

describe('RepositoryRow', function () {
  beforeEach(function () {
    MockApiClient.clearMockResponses();
  });

  const repository = TestStubs.Repository();
  const pendingRepo = TestStubs.Repository({
    status: 'pending_deletion',
  });
  const customRepo = TestStubs.Repository({
    provider: {
      id: 'integrations:custom_scm',
    },
  });
  const customPendingRepo = TestStubs.Repository({
    provider: {
      id: 'integrations:custom_scm',
    },
    status: 'pending_deletion',
  });
  const api = new Client();

  describe('rendering with access', function () {
    const organization = TestStubs.Organization({
      access: ['org:integrations'],
    });
    const routerContext = TestStubs.routerContext([{organization}]);

    it('displays provider information', async function () {
      render(
        <RepositoryRow
          repository={repository}
          api={api}
          orgId={organization.slug}
          organization={organization}
        />,
        {context: routerContext}
      );
      expect(screen.getByText(repository.name)).toBeInTheDocument();
      expect(screen.getByText('github.com/example/repo-name')).toBeInTheDocument();

      // Trash button should display enabled
      expect(screen.getByRole('button', {name: 'delete'})).toBeEnabled();

      // No cancel button
      expect(screen.queryByRole('button', {name: 'Cancel'})).not.toBeInTheDocument();
    });

    it('displays cancel pending button', async function () {
      render(
        <RepositoryRow
          repository={pendingRepo}
          api={api}
          orgId={organization.slug}
          organization={organization}
        />,
        {context: routerContext}
      );

      // Trash button should be disabled
      expect(screen.getByRole('button', {name: 'delete'})).toBeDisabled();

      // Cancel button active
      expect(screen.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Cancel'})).toBeEnabled();
    });
  });

  describe('rendering without access', function () {
    const organization = TestStubs.Organization({
      access: ['org:write'],
    });
    const routerContext = TestStubs.routerContext([{organization}]);

    it('displays disabled trash', async function () {
      render(
        <RepositoryRow
          repository={repository}
          api={api}
          orgId={organization.slug}
          organization={organization}
        />,
        {context: routerContext}
      );

      // Trash button should be disabled
      expect(screen.getByRole('button', {name: 'delete'})).toBeDisabled();
    });

    it('displays disabled cancel', async function () {
      render(
        <RepositoryRow
          repository={pendingRepo}
          api={api}
          orgId={organization.slug}
          organization={organization}
        />,
        {context: routerContext}
      );

      // Cancel should be disabled
      expect(screen.getByRole('button', {name: 'Cancel'})).toBeDisabled();
    });
  });

  describe('deletion', function () {
    const organization = TestStubs.Organization({
      access: ['org:integrations'],
    });
    const routerContext = TestStubs.routerContext([{organization}]);

    it('sends api request on delete', async function () {
      const deleteRepo = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/repos/${repository.id}/`,
        method: 'DELETE',
        statusCode: 204,
        body: {},
      });

      render(
        <RepositoryRow
          repository={repository}
          api={api}
          orgId={organization.slug}
          organization={organization}
        />,
        {context: routerContext}
      );
      renderGlobalModal();
      await userEvent.click(screen.getByRole('button', {name: 'delete'}));

      // Confirm modal
      await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

      expect(deleteRepo).toHaveBeenCalled();
    });
  });

  describe('cancel deletion', function () {
    const organization = TestStubs.Organization({
      access: ['org:integrations'],
    });
    const routerContext = TestStubs.routerContext([{organization}]);

    it('sends api request to cancel', async function () {
      const cancel = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/repos/${pendingRepo.id}/`,
        method: 'PUT',
        statusCode: 204,
        body: {},
      });

      render(
        <RepositoryRow
          repository={pendingRepo}
          api={api}
          orgId={organization.slug}
          organization={organization}
        />,
        {context: routerContext}
      );
      await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

      expect(cancel).toHaveBeenCalled();
    });
  });

  describe('renders custom_scm repo', function () {
    const organization = TestStubs.Organization({
      access: ['org:integrations'],
      features: ['integrations-custom-scm'],
    });
    const routerContext = TestStubs.routerContext([{organization}]);

    it('displays edit button', async function () {
      render(
        <RepositoryRow
          repository={customRepo}
          api={api}
          orgId={organization.slug}
          organization={organization}
        />,
        {context: routerContext}
      );

      // Trash button should display enabled
      expect(screen.getByRole('button', {name: 'delete'})).toBeEnabled();
      // No cancel button
      expect(screen.queryByRole('button', {name: 'Cancel'})).not.toBeInTheDocument();

      // Edit button should display enabled
      expect(screen.getByRole('button', {name: 'edit'})).toBeEnabled();
    });

    it('disables edit button when cancel pending', async function () {
      render(
        <RepositoryRow
          repository={customPendingRepo}
          api={api}
          orgId={organization.slug}
          organization={organization}
        />,
        {context: routerContext}
      );

      // Trash button should be disabled
      expect(screen.getByRole('button', {name: 'delete'})).toBeDisabled();

      // Edit button should be disabled
      expect(screen.getByRole('button', {name: 'edit'})).toBeDisabled();

      // Cancel button active
      expect(screen.queryByRole('button', {name: 'Cancel'})).toBeEnabled();
    });
  });
});
