import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';

import {render, screen} from 'sentry-test/reactTestingLibrary';

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

const permissionLimitedSlack: ScmMessagingResolvedProvider = {
  ...installableSlack,
  status: 'permission-limited',
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
  });

  describe.each<[RowVisualState, ScmMessagingResolvedProvider]>([
    ['install-forbidden', installableSlack],
    ['permission-limited', permissionLimitedSlack],
  ])('%s state', (visualState, resolvedProvider) => {
    it('renders a disabled Connect button', () => {
      renderActions(visualState, {resolvedProvider});
      expect(screen.getByRole('button', {name: /Connect/})).toBeDisabled();
    });
  });

  describe('choose-destination state', () => {
    it('renders the Choose destination button', () => {
      renderActions('choose-destination');
      expect(
        screen.getByRole('button', {name: /Choose destination for Slack/})
      ).toBeInTheDocument();
    });
  });

  describe('configured state', () => {
    it('renders Edit and Remove buttons', () => {
      renderActions('configured');

      expect(screen.getByRole('button', {name: /Edit/})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: /Remove/})).toBeInTheDocument();
    });
  });

  describe('removing state', () => {
    it('renders Cancel and Remove buttons', () => {
      renderActions('removing');

      expect(screen.getByRole('button', {name: /Cancel/})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Remove'})).toBeInTheDocument();
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
