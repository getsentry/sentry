import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {SeerExplorerHeader} from 'sentry/views/seerExplorer/components/seerExplorerHeader';
import {SeerExplorerSessionsProvider} from 'sentry/views/seerExplorer/seerExplorerSessionContext';

const BASE_FEATURES = ['seer-explorer', 'gen-ai-features'];

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
    overrideCtxEngEnable: false,
    onOverrideCtxEngEnableToggle: jest.fn(),
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
    it('does not render when no debug feature flags are enabled', async () => {
      await renderHeader();
      expect(screen.queryByRole('button', {name: 'Debug'})).not.toBeInTheDocument();
    });

    it('renders only the enabled toggle', async () => {
      await renderHeader({}, orgWith('seer-explorer-thinking-blocks'));

      await userEvent.click(screen.getByRole('button', {name: 'Debug'}));

      expect(
        screen.getByRole('menuitemradio', {name: /Show thinking/})
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('menuitemradio', {name: /Context Engine/})
      ).not.toBeInTheDocument();
    });

    it('reflects the toggle state and fires the handler', async () => {
      const onOverrideCtxEngEnableToggle = jest.fn();
      await renderHeader(
        {overrideCtxEngEnable: true, onOverrideCtxEngEnableToggle},
        orgWith('seer-explorer-context-engine-fe-override-ui-flag')
      );

      await userEvent.click(screen.getByRole('button', {name: 'Debug'}));

      expect(screen.getByRole('checkbox')).toBeChecked();

      await userEvent.click(screen.getByRole('menuitemradio', {name: /Context Engine/}));
      expect(onOverrideCtxEngEnableToggle).toHaveBeenCalled();
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
      expect(screen.getByRole('button', {name: 'New chat'})).toBeDisabled();
      expect(
        screen.getByRole('button', {name: 'Start a new chat (/new)'})
      ).toBeDisabled();
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
      await renderHeader();

      // Both the inline and overflow variants mount a chat history trigger.
      const [chatHistory] = screen.getAllByRole('button', {name: 'Chat history'});
      await userEvent.click(chatHistory!);
      expect(
        await screen.findByPlaceholderText('Search chats\u2026')
      ).toBeInTheDocument();
    });
  });
});
