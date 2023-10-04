import {Organization} from 'sentry-fixture/organization';
import {Repository} from 'sentry-fixture/repository';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import RepositoryRow from 'sentry/components/repositoryRow';
import {RepositoryStatus} from 'sentry/types';

describe('RepositoryRow', function () {
  beforeEach(function () {
    MockApiClient.clearMockResponses();
  });

  const repository = Repository();
  const pendingRepo = Repository({
    status: RepositoryStatus.PENDING_DELETION,
  });

  const api = new MockApiClient();

  describe('rendering with access', function () {
    const organization = Organization({
      access: ['org:integrations'],
    });

    it('displays provider information', function () {
      render(
        <RepositoryRow repository={repository} api={api} orgSlug={organization.slug} />,
        {organization}
      );
      expect(screen.getByText(repository.name)).toBeInTheDocument();
      expect(screen.getByText('github.com/example/repo-name')).toBeInTheDocument();

      // Trash button should display enabled
      expect(screen.getByRole('button', {name: 'delete'})).toBeEnabled();

      // No cancel button
      expect(screen.queryByRole('button', {name: 'Cancel'})).not.toBeInTheDocument();
    });

    it('displays cancel pending button', function () {
      render(
        <RepositoryRow repository={pendingRepo} api={api} orgSlug={organization.slug} />,
        {organization}
      );

      // Trash button should be disabled
      expect(screen.getByRole('button', {name: 'delete'})).toBeDisabled();

      // Cancel button active
      expect(screen.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Cancel'})).toBeEnabled();
    });
  });

  describe('rendering without access', function () {
    const organization = Organization({
      access: ['org:write'],
    });

    it('displays disabled trash', function () {
      render(
        <RepositoryRow repository={repository} api={api} orgSlug={organization.slug} />,
        {organization}
      );

      // Trash button should be disabled
      expect(screen.getByRole('button', {name: 'delete'})).toBeDisabled();
    });

    it('displays disabled cancel', function () {
      render(
        <RepositoryRow repository={pendingRepo} api={api} orgSlug={organization.slug} />,
        {organization}
      );

      // Cancel should be disabled
      expect(screen.getByRole('button', {name: 'Cancel'})).toBeDisabled();
    });
  });

  describe('deletion', function () {
    const organization = Organization({
      access: ['org:integrations'],
    });

    it('sends api request to hide upon clicking delete', async function () {
      const deleteRepo = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/repos/${repository.id}/`,
        method: 'PUT',
        statusCode: 204,
        body: {status: 'hidden'},
      });

      render(
        <RepositoryRow repository={repository} api={api} orgSlug={organization.slug} />,
        {organization}
      );
      renderGlobalModal();
      await userEvent.click(screen.getByRole('button', {name: 'delete'}));

      // Confirm modal
      await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

      expect(deleteRepo).toHaveBeenCalled();
    });
  });

  describe('cancel deletion', function () {
    const organization = Organization({
      access: ['org:integrations'],
    });

    it('sends api request to cancel', async function () {
      const cancel = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/repos/${pendingRepo.id}/`,
        method: 'PUT',
        statusCode: 204,
        body: {},
      });

      render(
        <RepositoryRow repository={pendingRepo} api={api} orgSlug={organization.slug} />,
        {organization}
      );
      await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

      expect(cancel).toHaveBeenCalled();
    });
  });
});
