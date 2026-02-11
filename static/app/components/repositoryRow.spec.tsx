import {OrganizationFixture} from 'sentry-fixture/organization';
import {RepositoryFixture} from 'sentry-fixture/repository';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import RepositoryRow from 'sentry/components/repositoryRow';
import {RepositoryStatus} from 'sentry/types/integrations';

describe('RepositoryRow', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  const repository = RepositoryFixture();
  const pendingRepo = RepositoryFixture({
    status: RepositoryStatus.PENDING_DELETION,
  });
  const unknownProviderRepo = RepositoryFixture({
    provider: {id: 'unknown', name: 'Unknown Provider'},
  });

  describe('rendering with access', () => {
    const organization = OrganizationFixture({
      access: ['org:integrations'],
    });

    it('displays provider information', () => {
      render(<RepositoryRow repository={repository} orgSlug={organization.slug} />, {
        organization,
      });
      expect(screen.getByText(repository.name)).toBeInTheDocument();
      expect(screen.getByText('github.com/example/repo-name')).toBeInTheDocument();

      // Trash button should display enabled
      expect(screen.getByRole('button', {name: 'delete'})).toBeEnabled();

      // No cancel button
      expect(screen.queryByRole('button', {name: 'Cancel'})).not.toBeInTheDocument();
    });

    it('displays "Unknown Provider" with a help tooltip for repos without a provider', () => {
      render(
        <RepositoryRow
          repository={unknownProviderRepo}
          orgSlug={organization.slug}
          showProvider
        />,
        {organization}
      );

      expect(screen.getByText('Unknown Provider')).toBeInTheDocument();
      expect(screen.getByTestId('more-information')).toBeInTheDocument();
    });

    it('displays provider name when provider is known', () => {
      render(
        <RepositoryRow
          repository={repository}
          orgSlug={organization.slug}
          showProvider
        />,
        {organization}
      );

      expect(screen.getByText('github')).toBeInTheDocument();
      expect(screen.queryByTestId('more-information')).not.toBeInTheDocument();
    });

    it('displays cancel pending button', () => {
      render(<RepositoryRow repository={pendingRepo} orgSlug={organization.slug} />, {
        organization,
      });

      // Trash button should be disabled
      expect(screen.getByRole('button', {name: 'delete'})).toBeDisabled();

      // Cancel button active
      expect(screen.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Cancel'})).toBeEnabled();
    });
  });

  describe('rendering without access', () => {
    const organization = OrganizationFixture({
      access: ['org:write'],
    });

    it('displays disabled trash', () => {
      render(<RepositoryRow repository={repository} orgSlug={organization.slug} />, {
        organization,
      });

      // Trash button should be disabled
      expect(screen.getByRole('button', {name: 'delete'})).toBeDisabled();
    });

    it('displays disabled cancel', () => {
      render(<RepositoryRow repository={pendingRepo} orgSlug={organization.slug} />, {
        organization,
      });

      // Cancel should be disabled
      expect(screen.getByRole('button', {name: 'Cancel'})).toBeDisabled();
    });
  });

  describe('deletion', () => {
    const organization = OrganizationFixture({
      access: ['org:integrations'],
    });

    it('sends api request to hide upon clicking delete', async () => {
      const deleteRepo = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/repos/${repository.id}/`,
        method: 'PUT',
        statusCode: 204,
        body: {status: 'hidden'},
      });

      render(<RepositoryRow repository={repository} orgSlug={organization.slug} />, {
        organization,
      });
      renderGlobalModal();
      await userEvent.click(screen.getByRole('button', {name: 'delete'}));

      // Confirm modal
      await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

      expect(deleteRepo).toHaveBeenCalled();
    });
  });

  describe('cancel deletion', () => {
    const organization = OrganizationFixture({
      access: ['org:integrations'],
    });

    it('sends api request to cancel', async () => {
      const cancel = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/repos/${pendingRepo.id}/`,
        method: 'PUT',
        statusCode: 204,
        body: {},
      });

      render(<RepositoryRow repository={pendingRepo} orgSlug={organization.slug} />, {
        organization,
      });
      await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

      expect(cancel).toHaveBeenCalled();
    });
  });
});
