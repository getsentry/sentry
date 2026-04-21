import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {SeerExplorerContext} from 'sentry/views/seerExplorer/useSeerExplorerContext';

import {ExplorerFloatingActionButton} from './explorerFAB';

// Mock createPortal to render content directly
jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  createPortal: (node: React.ReactNode) => node,
}));

const organization = OrganizationFixture({
  features: ['seer-explorer'],
  hideAiFeatures: false,
  openMembership: true,
});

function renderFAB(
  options?: Parameters<typeof render>[1],
  contextOverrides?: Partial<React.ContextType<typeof SeerExplorerContext>>
) {
  const contextValue = {
    isOpen: false,
    isMinimized: false,
    openSeerExplorer: jest.fn(),
    closeSeerExplorer: jest.fn(),
    toggleSeerExplorer: jest.fn(),
    setIsMinimized: jest.fn(),
    ...contextOverrides,
  };

  return {
    ...render(
      <SeerExplorerContext value={contextValue}>
        <ExplorerFloatingActionButton />
      </SeerExplorerContext>,
      options
    ),
    contextValue,
  };
}

describe('ExplorerFloatingActionButton', () => {
  describe('visibility gating', () => {
    it('renders when feature is enabled', async () => {
      renderFAB({organization});
      expect(await screen.findByRole('button', {name: /ask seer/i})).toBeInTheDocument();
    });

    it('does not render when feature flag is disabled', () => {
      const {container} = renderFAB({
        organization: OrganizationFixture({
          features: [],
          hideAiFeatures: false,
          openMembership: true,
        }),
      });
      expect(container).toBeEmptyDOMElement();
    });

    it('does not render when open membership is disabled', () => {
      const {container} = renderFAB({
        organization: OrganizationFixture({
          features: ['seer-explorer'],
          hideAiFeatures: false,
          openMembership: false,
        }),
      });
      expect(container).toBeEmptyDOMElement();
    });

    it('does not render when seer explorer drawer is open', () => {
      const {container} = renderFAB({organization}, {isOpen: true});
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('interaction', () => {
    it('calls openSeerExplorer when clicked', async () => {
      const {contextValue} = renderFAB({organization});

      await userEvent.click(await screen.findByRole('button', {name: /ask seer/i}));

      expect(contextValue.openSeerExplorer).toHaveBeenCalledTimes(1);
    });
  });
});
