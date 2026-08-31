import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {ScmMessagingResolvedProvider} from 'sentry/components/onboarding/scm/useScmMessagingProviders';

import {RowActions} from './action';
import type {RowVisualState} from './types';

const slackProvider = GitHubIntegrationProviderFixture({key: 'slack', name: 'Slack'});

const installableSlack: ScmMessagingResolvedProvider = {
  providerKey: 'slack',
  provider: slackProvider,
  status: 'installable',
  eligibleIntegrations: [],
  permissionLimitedIntegration: undefined,
};

function renderActions(
  visualState: RowVisualState,
  overrides: Partial<React.ComponentProps<typeof RowActions>> = {}
) {
  return render(
    <RowActions
      visualState={visualState}
      resolvedProvider={installableSlack}
      onConnect={jest.fn()}
      onChooseDestination={jest.fn()}
      onEditDestination={jest.fn()}
      onStartRemoving={jest.fn()}
      onCancelRemoving={jest.fn()}
      onConfirmRemove={jest.fn()}
      {...overrides}
    />
  );
}

describe('RowActions', () => {
  describe.each<RowVisualState>(['loading', 'installing'])('%s state', visualState => {
    it('shows a spinner', () => {
      renderActions(visualState);
      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    });
  });

  describe('installable state', () => {
    it('renders an enabled Connect button', () => {
      renderActions('installable');
      expect(screen.getByRole('button', {name: /Connect Slack/})).toBeEnabled();
    });

    it('calls onConnect when clicked', async () => {
      const onConnect = jest.fn();
      renderActions('installable', {onConnect});

      await userEvent.click(screen.getByRole('button', {name: /Connect/}));

      expect(onConnect).toHaveBeenCalledTimes(1);
    });

    it('renders a disabled Connect button when canAdd is false', () => {
      renderActions('installable', {
        resolvedProvider: {
          ...installableSlack,
          provider: {...slackProvider, canAdd: false},
        },
      });
      expect(screen.getByRole('button', {name: /Connect/})).toBeDisabled();
    });
  });

  describe.each<RowVisualState>(['install-forbidden', 'permission-limited'])(
    '%s state',
    visualState => {
      it('renders a disabled Connect button', () => {
        renderActions(visualState);
        expect(screen.getByRole('button', {name: /Connect/})).toBeDisabled();
      });
    }
  );

  describe('choose-destination state', () => {
    it('renders the Choose destination button', () => {
      renderActions('choose-destination');
      expect(
        screen.getByRole('button', {name: /Choose destination for Slack/})
      ).toBeInTheDocument();
    });

    it('calls onChooseDestination when clicked', async () => {
      const onChooseDestination = jest.fn();
      renderActions('choose-destination', {onChooseDestination});

      await userEvent.click(screen.getByRole('button', {name: /Choose destination/}));

      expect(onChooseDestination).toHaveBeenCalledTimes(1);
    });
  });

  describe('configured state', () => {
    it('renders Edit and Remove buttons', () => {
      renderActions('configured');

      expect(screen.getByRole('button', {name: /Edit/})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: /Remove/})).toBeInTheDocument();
    });

    it('calls onEditDestination when Edit is clicked', async () => {
      const onEditDestination = jest.fn();
      renderActions('configured', {onEditDestination});

      await userEvent.click(screen.getByRole('button', {name: /Edit/}));

      expect(onEditDestination).toHaveBeenCalledTimes(1);
    });

    it('calls onStartRemoving when Remove is clicked', async () => {
      const onStartRemoving = jest.fn();
      renderActions('configured', {onStartRemoving});

      await userEvent.click(screen.getByRole('button', {name: /Remove/}));

      expect(onStartRemoving).toHaveBeenCalledTimes(1);
    });
  });

  describe('removing state', () => {
    it('renders Cancel and danger Remove buttons', () => {
      renderActions('removing');

      expect(screen.getByRole('button', {name: /Cancel/})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Remove'})).toBeInTheDocument();
    });

    it('calls onCancelRemoving when Cancel is clicked', async () => {
      const onCancelRemoving = jest.fn();
      renderActions('removing', {onCancelRemoving});

      await userEvent.click(screen.getByRole('button', {name: /Cancel/}));

      expect(onCancelRemoving).toHaveBeenCalledTimes(1);
    });

    it('calls onConfirmRemove when Remove is clicked', async () => {
      const onConfirmRemove = jest.fn();
      renderActions('removing', {onConfirmRemove});

      await userEvent.click(screen.getByRole('button', {name: 'Remove'}));

      expect(onConfirmRemove).toHaveBeenCalledTimes(1);
    });
  });

  describe.each<RowVisualState>(['install-error', 'configuring'])(
    '%s state',
    visualState => {
      it('renders nothing', () => {
        const {container} = renderActions(visualState);
        expect(container).toBeEmptyDOMElement();
      });
    }
  );
});
