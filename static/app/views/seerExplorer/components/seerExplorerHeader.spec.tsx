import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';
import {SeerExplorerSessionsProvider} from 'sentry/views/seerExplorer/seerExplorerSessionContext';

import {SeerExplorerHeader} from './seerExplorerHeader';

const BASE_FEATURES = ['seer-explorer'];

function orgWith(...extraFeatures: string[]) {
  return OrganizationFixture({
    openMembership: true,
    hideAiFeatures: false,
    features: [...BASE_FEATURES, ...extraFeatures],
  });
}

function defaultProps(overrides = {}) {
  return {
    onNewChatClick: jest.fn(),
    onChangeSession: jest.fn(),
    onCopySessionClick: jest.fn(),
    onCopyLinkClick: jest.fn(),
    overrideBashModeEnabled: false,
    onOverrideBashModeToggle: jest.fn(),
    showThinking: false,
    onShowThinkingToggle: jest.fn(),
    isPipSupported: false,
    isPoppedOut: false,
    onTogglePictureInPicture: jest.fn(),
    ...overrides,
  };
}

describe('SeerExplorerHeader', () => {
  beforeEach(() => {
    ConfigStore.set('user', UserFixture());
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/seer/runs/`,
      method: 'GET',
      body: [],
    });
  });

  // The header selects between its inline and compact variants purely with CSS
  // container queries, which jsdom doesn't evaluate — so both variants (and both
  // New Chat buttons) are always in the DOM here. These tests assert presence and
  // behavior; which variant is actually visible at a given width is a CSS concern
  // verified visually.
  function mockChatHistory() {
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/seer/runs/`,
      method: 'GET',
      body: [{id: 1, title: 'Flaky deploy', lastTriggeredAt: '2026-11-11T00:00:00Z'}],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/seer/runs/`,
      method: 'GET',
      body: [],
      match: [MockApiClient.matchQuery({query: 'nothing'})],
    });
  }

  async function renderHeader(props = {}, org = orgWith()) {
    const result = render(
      <SeerExplorerSessionsProvider>
        <SeerExplorerHeader {...defaultProps(props)} />
      </SeerExplorerSessionsProvider>,
      {organization: org}
    );
    // Flush the pending sessions query so its async state update lands in act().
    await screen.findByText('Seer Agent');
    return result;
  }

  describe('Debug menu', () => {
    beforeEach(() => {
      ConfigStore.set(
        'user',
        UserFixture({
          emails: [{email: 'employee@sentry.io', is_verified: true, id: '1'}],
        })
      );
    });

    it('renders the force bash mode toggle', async () => {
      await renderHeader();

      await userEvent.click(screen.getByRole('button', {name: 'Debug'}));

      expect(
        screen.getByRole('option', {name: /Force bash mode on/})
      ).toBeInTheDocument();
    });

    it('does not render for non-employees', async () => {
      ConfigStore.set('user', UserFixture());
      await renderHeader();

      expect(screen.queryByRole('button', {name: 'Debug'})).not.toBeInTheDocument();
    });

    it('renders the thinking toggle behind its flag', async () => {
      await renderHeader({}, orgWith('seer-explorer-thinking-blocks'));

      await userEvent.click(screen.getByRole('button', {name: 'Debug'}));

      expect(screen.getByRole('option', {name: /Show thinking/})).toBeInTheDocument();
      expect(
        screen.getByRole('option', {name: /Force bash mode on/})
      ).toBeInTheDocument();
    });

    it('hides the thinking toggle when code mode tools is enabled', async () => {
      await renderHeader(
        {},
        orgWith('seer-explorer-thinking-blocks', 'seer-explorer-code-mode-tools')
      );

      await userEvent.click(screen.getByRole('button', {name: 'Debug'}));

      expect(
        screen.queryByRole('option', {name: /Show thinking/})
      ).not.toBeInTheDocument();
    });

    it('toggles force bash mode', async () => {
      const onOverrideBashModeToggle = jest.fn();
      await renderHeader({overrideBashModeEnabled: true, onOverrideBashModeToggle});

      await userEvent.click(screen.getByRole('button', {name: 'Debug'}));

      expect(screen.getByRole('option', {name: /Force bash mode on/})).toHaveAttribute(
        'aria-selected',
        'true'
      );

      await userEvent.click(screen.getByRole('option', {name: /Force bash mode on/}));
      expect(onOverrideBashModeToggle).toHaveBeenCalled();
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('renders the agent trace link alongside the toggles', async () => {
      const conversationsUrl =
        'https://sentry.io/organizations/sentry/explore/conversations/run-id/';
      await renderHeader({conversationsUrl});

      await userEvent.click(screen.getByRole('button', {name: 'Debug'}));

      expect(
        screen.getByRole('option', {name: /Force bash mode on/})
      ).toBeInTheDocument();
      expect(screen.getByRole('option', {name: 'Open agent trace'})).toBeInTheDocument();
    });

    it('opens the agent trace in a new tab without toggling anything', async () => {
      const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
      const onOverrideBashModeToggle = jest.fn();
      const conversationsUrl =
        'https://sentry.io/organizations/sentry/explore/conversations/run-id/';
      await renderHeader({conversationsUrl, onOverrideBashModeToggle});

      await userEvent.click(screen.getByRole('button', {name: 'Debug'}));
      await userEvent.click(screen.getByRole('option', {name: 'Open agent trace'}));

      expect(openSpy).toHaveBeenCalledWith(
        conversationsUrl,
        '_blank',
        'noopener,noreferrer'
      );
      expect(onOverrideBashModeToggle).not.toHaveBeenCalled();
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      openSpy.mockRestore();
    });

    it('does not render the agent trace link for non-employees', async () => {
      ConfigStore.set('user', UserFixture());
      await renderHeader({
        conversationsUrl:
          'https://sentry.io/organizations/sentry/explore/conversations/run-id/',
      });

      expect(screen.queryByRole('button', {name: 'Debug'})).not.toBeInTheDocument();
    });
  });

  describe('New chat', () => {
    // The labelled button and the icon-only fallback are both rendered; a
    // container query hides one. They carry distinct accessible names.
    it('renders both a labelled and an icon-only variant', async () => {
      await renderHeader();
      expect(screen.getByRole('button', {name: 'New chat'})).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'Start a new chat (/new)'})
      ).toBeInTheDocument();
    });

    it('fires onNewChatClick', async () => {
      const onNewChatClick = jest.fn();
      await renderHeader({onNewChatClick});

      await userEvent.click(screen.getByRole('button', {name: 'New chat'}));
      expect(onNewChatClick).toHaveBeenCalled();
    });

    it('disables both variants when disableNewChatButton is set', async () => {
      await renderHeader({disableNewChatButton: true});
      expect(screen.getByRole('button', {name: 'New chat'})).toHaveAttribute(
        'aria-disabled',
        'true'
      );
      expect(
        screen.getByRole('button', {name: 'Start a new chat (/new)'})
      ).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('Middle actions', () => {
    it('renders both the inline actions and the overflow menu', async () => {
      await renderHeader();

      expect(
        screen.getByRole('button', {name: 'Copy conversation to clipboard'})
      ).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'More actions'})).toBeInTheDocument();
    });

    it('fires the copy handler from the inline button', async () => {
      const onCopySessionClick = jest.fn();
      await renderHeader({onCopySessionClick});

      await userEvent.click(
        screen.getByRole('button', {name: 'Copy conversation to clipboard'})
      );
      expect(onCopySessionClick).toHaveBeenCalled();
    });

    it('exposes link and copy in the overflow menu', async () => {
      await renderHeader();

      await userEvent.click(screen.getByRole('button', {name: 'More actions'}));

      expect(
        screen.getByRole('menuitemradio', {name: /Link to chat/})
      ).toBeInTheDocument();
      expect(
        screen.getByRole('menuitemradio', {name: /Copy conversation to clipboard/})
      ).toBeInTheDocument();
    });

    it('opens a searchable chat history dropdown', async () => {
      mockChatHistory();
      await renderHeader();

      // Both the inline and overflow variants mount a chat history trigger.
      const [chatHistory] = screen.getAllByRole('button', {name: 'Chat history'});
      await userEvent.click(chatHistory!);
      expect(
        await screen.findByPlaceholderText('Search chats\u2026')
      ).toBeInTheDocument();
    });

    it('shows an empty state when there is no chat history', async () => {
      await renderHeader();

      const [chatHistory] = screen.getAllByRole('button', {name: 'Chat history'});
      await userEvent.click(chatHistory!);
      expect(await screen.findByText('No chats yet')).toBeInTheDocument();
      expect(screen.queryByPlaceholderText('Search chats\u2026')).not.toBeInTheDocument();
    });

    it('shows a no-results state when a search matches nothing', async () => {
      mockChatHistory();
      await renderHeader();

      const [chatHistory] = screen.getAllByRole('button', {name: 'Chat history'});
      await userEvent.click(chatHistory!);
      await userEvent.type(
        await screen.findByPlaceholderText('Search chats\u2026'),
        'nothing'
      );
      expect(await screen.findByText('No chats match your search.')).toBeInTheDocument();
    });
  });
});
