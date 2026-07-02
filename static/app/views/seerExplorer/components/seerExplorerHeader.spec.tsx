import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Flex} from '@sentry/scraps/layout';

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

// The header resolves its layout from its query container's width (via
// `useContainerBreakpoint`), so wrap it in a container and fake `clientWidth`.
const originalClientWidth = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'clientWidth'
);

function setContainerWidth(width: number) {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => width,
  });
}

describe('SeerExplorerHeader', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/seer/explorer-runs/`,
      method: 'GET',
      body: {data: []},
    });
    // Wide enough for the expanded (inline) layout by default.
    setContainerWidth(800);
  });

  afterEach(() => {
    if (originalClientWidth) {
      Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClientWidth);
    }
  });

  async function renderHeader(props = {}, org = orgWith()) {
    const result = render(
      <SeerExplorerSessionsProvider>
        <Flex containerType="inline-size">
          <SeerExplorerHeader {...defaultProps(props)} />
        </Flex>
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
    it('fires onNewChatClick', async () => {
      const onNewChatClick = jest.fn();
      await renderHeader({onNewChatClick});

      await userEvent.click(
        screen.getByRole('button', {name: 'Start a new chat (/new)'})
      );
      expect(onNewChatClick).toHaveBeenCalled();
    });

    it('is disabled when disableNewChatButton is set', async () => {
      await renderHeader({disableNewChatButton: true});
      expect(
        screen.getByRole('button', {name: 'Start a new chat (/new)'})
      ).toBeDisabled();
    });
  });

  describe('Middle actions', () => {
    it('renders inline actions when the container is wide', async () => {
      setContainerWidth(800);
      await renderHeader();

      expect(
        screen.getByRole('button', {name: 'Copy conversation to clipboard'})
      ).toBeInTheDocument();
      // Not collapsed, so no overflow menu.
      expect(
        screen.queryByRole('button', {name: 'More actions'})
      ).not.toBeInTheDocument();
    });

    it('collapses into the overflow menu when the container is narrow', async () => {
      setContainerWidth(320);
      await renderHeader();

      expect(screen.getByRole('button', {name: 'More actions'})).toBeInTheDocument();
      // Collapsed, so the inline copy button is not rendered.
      expect(
        screen.queryByRole('button', {name: 'Copy conversation to clipboard'})
      ).not.toBeInTheDocument();
    });

    it('fires the copy handlers from the inline buttons', async () => {
      setContainerWidth(800);
      const onCopySessionClick = jest.fn();
      await renderHeader({onCopySessionClick});

      await userEvent.click(
        screen.getByRole('button', {name: 'Copy conversation to clipboard'})
      );
      expect(onCopySessionClick).toHaveBeenCalled();
    });

    it('exposes link and copy in the overflow menu', async () => {
      setContainerWidth(320);
      await renderHeader();

      await userEvent.click(screen.getByRole('button', {name: 'More actions'}));

      expect(
        await screen.findByRole('menuitemradio', {name: /Link to chat/})
      ).toBeInTheDocument();
      expect(
        screen.getByRole('menuitemradio', {name: /Copy conversation to clipboard/})
      ).toBeInTheDocument();
    });

    it('opens a searchable chat history dropdown', async () => {
      await renderHeader();

      await userEvent.click(screen.getByRole('button', {name: 'Chat history'}));
      expect(await screen.findByPlaceholderText('Search chats…')).toBeInTheDocument();
    });
  });
});
