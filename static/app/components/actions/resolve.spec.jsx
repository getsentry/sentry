import selectEvent from 'react-select-event';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import ResolveActions from 'sentry/components/actions/resolve';
import ModalStore from 'sentry/stores/modalStore';

describe('ResolveActions', function () {
  const spy = jest.fn();
  beforeEach(() => {
    ModalStore.reset();
  });
  afterEach(() => {
    spy.mockClear();
    MockApiClient.clearMockResponses();
  });

  describe('disabled', function () {
    it('does not call onUpdate when clicked', function () {
      render(
        <ResolveActions
          onUpdate={spy}
          disabled
          hasRelease={false}
          orgSlug="org-1"
          projectSlug="proj-1"
        />
      );
      const button = screen.getByRole('button', {name: 'Resolve'});
      expect(button).toBeDisabled();
      userEvent.click(button);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('disableDropdown', function () {
    it('main button calls onUpdate when clicked and dropdown menu disabled', function () {
      render(
        <ResolveActions
          onUpdate={spy}
          disableDropdown
          hasRelease={false}
          orgSlug="org-1"
          projectSlug="proj-1"
        />
      );

      const button = screen.getByRole('button', {name: 'Resolve'});
      expect(button).toBeEnabled();
      userEvent.click(button);
      expect(spy).toHaveBeenCalled();

      // Dropdown menu is disabled
      expect(screen.getByRole('button', {name: 'More resolve options'})).toBeDisabled();
    });
  });

  describe('resolved', function () {
    it('calls onUpdate with unresolved status when clicked', function () {
      render(
        <ResolveActions
          onUpdate={spy}
          disabled
          hasRelease={false}
          orgSlug="org-1"
          projectSlug="proj-1"
          isResolved
        />
      );

      const button = screen.getByRole('button', {name: 'Unresolve'});
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('');

      userEvent.click(button);
      expect(spy).toHaveBeenCalledWith({status: 'unresolved', statusDetails: {}});
    });
  });

  describe('auto resolved', function () {
    it('cannot be unresolved manually', function () {
      render(
        <ResolveActions
          onUpdate={spy}
          disabled
          hasRelease={false}
          orgSlug="org-1"
          projectSlug="proj-1"
          isResolved
          isAutoResolved
        />
      );

      userEvent.click(screen.getByRole('button', {name: 'Unresolve'}));
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('without confirmation', function () {
    it('calls spy with resolved status when clicked', function () {
      render(
        <ResolveActions
          onUpdate={spy}
          hasRelease={false}
          orgSlug="org-1"
          projectSlug="proj-1"
        />
      );
      userEvent.click(screen.getByRole('button', {name: 'Resolve'}));
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith({status: 'resolved', statusDetails: {}});
    });
  });

  describe('with confirmation step', function () {
    it('displays confirmation modal with message provided', function () {
      render(
        <ResolveActions
          onUpdate={spy}
          hasRelease={false}
          orgSlug="org-1"
          projectSlug="proj-1"
          shouldConfirm
          confirmMessage="Are you sure???"
        />
      );
      renderGlobalModal();

      const button = screen.getByRole('button', {name: 'Resolve'});
      userEvent.click(button);

      const confirmButton = screen.getByTestId('confirm-button');
      expect(confirmButton).toBeInTheDocument();
      expect(spy).not.toHaveBeenCalled();

      userEvent.click(confirmButton);

      expect(spy).toHaveBeenCalled();
    });
  });

  it('can resolve in "another version"', async function () {
    const onUpdate = jest.fn();
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/releases/',
      body: [TestStubs.Release()],
    });
    render(
      <ResolveActions
        hasRelease
        orgSlug="org-slug"
        projectSlug="project-slug"
        onUpdate={onUpdate}
      />
    );
    renderGlobalModal();

    userEvent.click(screen.getByLabelText('More resolve options'));
    userEvent.click(screen.getByText('Another existing release…'));

    selectEvent.openMenu(screen.getByText('e.g. 1.0.4'));
    expect(await screen.findByText('1.2.0')).toBeInTheDocument();
    userEvent.click(screen.getByText('1.2.0'));

    userEvent.click(screen.getByRole('button', {name: 'Save Changes'}));
    expect(onUpdate).toHaveBeenCalledWith({
      status: 'resolved',
      statusDetails: {
        inRelease: 'sentry-android-shop@1.2.0',
      },
    });
  });
});
