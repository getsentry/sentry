import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import {TopBar, TopBarSlot, TopBarSlotProvider} from 'sentry/views/navigation/topBar';

jest.mock('sentry/views/seerExplorer/useExplorerPanel', () => ({
  useExplorerPanel: () => ({
    closeExplorerPanel: jest.fn(),
    isOpen: false,
    openExplorerPanel: jest.fn(),
    toggleExplorerPanel: jest.fn(),
  }),
}));

function TestSlots() {
  return (
    <TopBarSlotProvider>
      <TopBar />
      <div data-testid="page-content">
        <TopBarSlot.Title>
          <span>Title Content</span>
        </TopBarSlot.Title>
        <TopBarSlot.Actions>
          <span>Actions Content</span>
        </TopBarSlot.Actions>
        <TopBarSlot.Feedback>
          <span>Feedback Content</span>
        </TopBarSlot.Feedback>
      </div>
    </TopBarSlotProvider>
  );
}

describe('TopBar slots', () => {
  describe('with page-frame feature enabled', () => {
    const organization = OrganizationFixture({features: ['page-frame']});

    it('portals slot content out of their natural position and into the TopBar', () => {
      render(<TestSlots />, {organization});

      const pageContent = screen.getByTestId('page-content');

      expect(screen.getByText('Title Content')).toBeInTheDocument();
      expect(within(pageContent).queryByText('Title Content')).not.toBeInTheDocument();

      expect(screen.getByText('Actions Content')).toBeInTheDocument();
      expect(within(pageContent).queryByText('Actions Content')).not.toBeInTheDocument();

      expect(screen.getByText('Feedback Content')).toBeInTheDocument();
      expect(within(pageContent).queryByText('Feedback Content')).not.toBeInTheDocument();
    });
  });

  describe('with page-frame feature disabled', () => {
    const organization = OrganizationFixture({features: []});

    it('renders slot content in their natural position', () => {
      render(<TestSlots />, {organization});

      const pageContent = screen.getByTestId('page-content');

      expect(within(pageContent).getByText('Title Content')).toBeInTheDocument();
      expect(within(pageContent).getByText('Actions Content')).toBeInTheDocument();
      expect(within(pageContent).getByText('Feedback Content')).toBeInTheDocument();
    });
  });
});
