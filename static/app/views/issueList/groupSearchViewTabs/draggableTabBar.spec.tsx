import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {
  DraggableTabBar,
  type Tab,
} from 'sentry/views/issueList/groupSearchViewTabs/draggableTabBar';
import {IssueSortOptions} from 'sentry/views/issueList/utils';

// biome-ignore lint/suspicious/noSkippedTests: <explanation>
describe.skip('DraggableTabBar', () => {
  const mockOnTabRenamed = jest.fn();
  const mockOnAddView = jest.fn();
  const mockOnDelete = jest.fn();
  const mockOnDiscard = jest.fn();
  const mockOnDuplicate = jest.fn();
  const mockOnSave = jest.fn();
  const mockOnDiscardTempView = jest.fn();
  const mockOnSaveTempView = jest.fn();

  const router = RouterFixture({
    location: {
      pathname: 'test',
    },
  });

  const tabs: Tab[] = [
    {
      id: '1',
      key: '1',
      label: 'Prioritized',
      query: 'priority:high',
      querySort: IssueSortOptions.DATE,
      unsavedChanges: ['priority:low', IssueSortOptions.DATE],
    },
    {
      id: '2',
      key: '2',
      label: 'For Review',
      query: 'is:unassigned',
      querySort: IssueSortOptions.DATE,
    },
    {
      id: '3',
      key: '3',
      label: 'Regressed',
      query: 'is:regressed',
      querySort: IssueSortOptions.DATE,
    },
  ];

  describe('Tabs render as expected', () => {
    it('should render tabs from props', () => {
      render(
        <DraggableTabBar
          initialTabKey="1"
          setTempTab={jest.fn()}
          tabs={tabs}
          setTabs={jest.fn()}
          onTabRenamed={mockOnTabRenamed}
          orgSlug={'test-org'}
          router={router}
        />
      );
      expect(screen.getAllByRole('tab').length).toBe(tabs.length);
      // The query count is included in the tab name here
      expect(screen.getByRole('tab', {name: 'Prioritized 20'})).toBeInTheDocument();
      expect(screen.getByRole('tab', {name: 'For Review 1000+'})).toBeInTheDocument();
      expect(screen.getByRole('tab', {name: 'Regressed'})).toBeInTheDocument();
    });
  });
  // Skipping this and next tests due to excessive unexplainable flakiness
  // biome-ignore lint/suspicious/noSkippedTests: <explanation>
  describe.skip('Tab menu options', () => {
    it('should render the correct set of actions for changed tabs', async () => {
      render(
        <DraggableTabBar
          initialTabKey="1"
          setTempTab={jest.fn()}
          tabs={tabs}
          setTabs={jest.fn()}
          onTabRenamed={mockOnTabRenamed}
          orgSlug={'test-org'}
          router={router}
        />
      );

      await userEvent.click(
        screen.getByRole('button', {name: 'Prioritized Tab Options'})
      );

      expect(
        await screen.findByRole('menuitemradio', {name: 'Save Changes'})
      ).toBeInTheDocument();
      expect(
        await screen.findByRole('menuitemradio', {name: 'Discard Changes'})
      ).toBeInTheDocument();
      expect(
        await screen.findByRole('menuitemradio', {name: 'Rename'})
      ).toBeInTheDocument();
      expect(
        await screen.findByRole('menuitemradio', {name: 'Duplicate'})
      ).toBeInTheDocument();
      expect(
        await screen.findByRole('menuitemradio', {name: 'Delete'})
      ).toBeInTheDocument();
    });

    it('should render the correct set of actions for unchanged tabs', async () => {
      render(
        <DraggableTabBar
          initialTabKey="1"
          setTempTab={jest.fn()}
          tabs={tabs}
          setTabs={jest.fn()}
          onTabRenamed={mockOnTabRenamed}
          orgSlug={'test-org'}
          router={router}
        />
      );
      // We need to explicitly click on the For Review tab since it is not the default (first) tab in props
      await userEvent.click(screen.getByRole('tab', {name: 'For Review 1000+'}));
      await userEvent.click(
        await screen.findByRole('button', {name: 'For Review Tab Options'})
      );

      expect(
        await screen.findByRole('menuitemradio', {name: 'Rename'})
      ).toBeInTheDocument();
      expect(
        await screen.findByRole('menuitemradio', {name: 'Duplicate'})
      ).toBeInTheDocument();
      expect(
        await screen.findByRole('menuitemradio', {name: 'Delete'})
      ).toBeInTheDocument();

      expect(
        screen.queryByRole('menuitemradio', {name: 'Save Changes'})
      ).not.toBeInTheDocument();

      expect(
        screen.queryByRole('menuitemradio', {name: 'Discard Changes'})
      ).not.toBeInTheDocument();
    });

    it('should render the correct set of actions for a single tab', async () => {
      render(
        <DraggableTabBar
          initialTabKey="1"
          setTempTab={jest.fn()}
          tabs={[tabs[1]]}
          setTabs={jest.fn()}
          onTabRenamed={mockOnTabRenamed}
          orgSlug={'test-org'}
          router={router}
        />
      );

      await userEvent.click(screen.getByRole('button', {name: 'For Review Tab Options'}));

      expect(
        await screen.findByRole('menuitemradio', {name: 'Rename'})
      ).toBeInTheDocument();
      expect(
        await screen.findByRole('menuitemradio', {name: 'Duplicate'})
      ).toBeInTheDocument();
      // Delete should not be present since there is only one tab
      expect(
        screen.queryByRole('menuitemradio', {name: 'Delete'})
      ).not.toBeInTheDocument();
    });

    it('should render the correct set of actions for temporary tabs', async () => {
      render(
        <DraggableTabBar
          initialTabKey="1"
          setTempTab={jest.fn()}
          tabs={tabs}
          setTabs={jest.fn()}
          onTabRenamed={mockOnTabRenamed}
          orgSlug={'test-org'}
          router={router}
        />
      );
      // We need to explicitly click on the For Review tab since it is not the default (first) tab in props
      await userEvent.click(screen.getByRole('tab', {name: 'Unsaved'}));
      await userEvent.click(
        await screen.findByRole('button', {name: 'Unsaved Tab Options'})
      );

      expect(
        await screen.findByRole('menuitemradio', {name: 'Save View'})
      ).toBeInTheDocument();
      expect(
        await screen.findByRole('menuitemradio', {name: 'Discard'})
      ).toBeInTheDocument();
    });
  });

  // biome-ignore lint/suspicious/noSkippedTests: <explanation>
  describe.skip('Tab actions', () => {
    it('should allow renaming a tab', async () => {
      render(
        <DraggableTabBar
          initialTabKey="1"
          setTempTab={jest.fn()}
          tabs={tabs}
          setTabs={jest.fn()}
          onTabRenamed={mockOnTabRenamed}
          orgSlug={'test-org'}
          router={router}
        />
      );
      await userEvent.click(screen.getByRole('tab', {name: 'For Review 1000+'}));
      await userEvent.click(
        await screen.findByRole('button', {name: 'For Review Tab Options'})
      );
      await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Rename'}));

      // Ctrl+A to select all text, then backspace to delete it
      // (We purposely do not highlight the text when hitting rename)
      await userEvent.keyboard('{Control>}A{/Control}{Backspace}');
      await userEvent.paste('New Name');
      await userEvent.keyboard('{enter}');

      expect(mockOnTabRenamed).toHaveBeenCalledWith('2', 'New Name');
    });

    it('should not allow renaming a tab to empty string', async () => {
      render(
        <DraggableTabBar
          initialTabKey="1"
          setTempTab={jest.fn()}
          tabs={tabs}
          setTabs={jest.fn()}
          onTabRenamed={mockOnTabRenamed}
          orgSlug={'test-org'}
          router={router}
        />
      );
      await userEvent.click(screen.getByRole('tab', {name: 'For Review 1000+'}));
      await userEvent.click(
        await screen.findByRole('button', {name: 'For Review Tab Options'})
      );
      await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Rename'}));

      await userEvent.keyboard('{Control>}A{/Control}{Backspace}');
      await userEvent.keyboard('{enter}');

      // Tab name should not have changed
      expect(screen.getByRole('tab', {name: 'For Review 1000+'})).toBeInTheDocument();

      expect(mockOnTabRenamed).not.toHaveBeenCalled();
    });

    it('should discard changes if esc is pressed while renaming', async () => {
      render(
        <DraggableTabBar
          initialTabKey="1"
          setTempTab={jest.fn()}
          tabs={tabs}
          setTabs={jest.fn()}
          onTabRenamed={mockOnTabRenamed}
          orgSlug={'test-org'}
          router={router}
        />
      );
      await userEvent.click(screen.getByRole('tab', {name: 'For Review 1000+'}));
      await userEvent.click(
        await screen.findByRole('button', {name: 'For Review Tab Options'})
      );
      await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Rename'}));

      await userEvent.keyboard('{Control>}A{/Control}{Backspace}');
      await userEvent.paste('New Name');
      await userEvent.keyboard('{esc}');

      expect(mockOnTabRenamed).not.toHaveBeenCalled();
    });

    it('should fire the onSave callback when save changes is pressed', async () => {
      render(
        <DraggableTabBar
          initialTabKey="1"
          setTempTab={jest.fn()}
          tabs={tabs}
          setTabs={jest.fn()}
          onSave={mockOnSave}
          orgSlug={'test-org'}
          router={router}
        />
      );
      await userEvent.click(screen.getByRole('tab', {name: 'Prioritized 20'}));
      await userEvent.click(
        await screen.findByRole('button', {name: 'Prioritized Tab Options'})
      );
      await userEvent.click(
        await screen.findByRole('menuitemradio', {name: 'Save Changes'})
      );

      expect(mockOnSave).toHaveBeenCalledWith('1');
    });

    it('should fire the onDiscard callback when discard is pressed', async () => {
      render(
        <DraggableTabBar
          initialTabKey="1"
          setTempTab={jest.fn()}
          tabs={tabs}
          setTabs={jest.fn()}
          onDiscard={mockOnDiscard}
          orgSlug={'test-org'}
          router={router}
        />
      );
      await userEvent.click(screen.getByRole('tab', {name: 'Prioritized 20'}));
      await userEvent.click(
        await screen.findByRole('button', {name: 'Prioritized Tab Options'})
      );
      await userEvent.click(
        await screen.findByRole('menuitemradio', {name: 'Discard Changes'})
      );

      expect(mockOnDiscard).toHaveBeenCalledWith('1');
    });

    it('should fire the onDelete callback when delete is pressed', async () => {
      render(
        <DraggableTabBar
          initialTabKey="1"
          setTempTab={jest.fn()}
          tabs={tabs}
          setTabs={jest.fn()}
          onDelete={mockOnDelete}
          orgSlug={'test-org'}
          router={router}
        />
      );
      await userEvent.click(screen.getByRole('tab', {name: 'For Review 1000+'}));
      await userEvent.click(
        await screen.findByRole('button', {name: 'For Review Tab Options'})
      );
      await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Delete'}));

      expect(mockOnDelete).toHaveBeenCalledWith('2');
    });

    it('should fire the onDuplicate callback when duplicate is pressed', async () => {
      render(
        <DraggableTabBar
          initialTabKey="1"
          setTempTab={jest.fn()}
          tabs={tabs}
          setTabs={jest.fn()}
          onDuplicate={mockOnDuplicate}
          orgSlug={'test-org'}
          router={router}
        />
      );
      await userEvent.click(screen.getByRole('tab', {name: 'For Review 1000+'}));
      await userEvent.click(
        await screen.findByRole('button', {name: 'For Review Tab Options'})
      );
      await userEvent.click(
        await screen.findByRole('menuitemradio', {name: 'Duplicate'})
      );

      expect(mockOnDuplicate).toHaveBeenCalledWith('2');
    });

    it('should fire the onDiscardTempView callback when the discard button is pressed for a temp view', async () => {
      render(
        <DraggableTabBar
          initialTabKey="1"
          setTempTab={jest.fn()}
          tabs={tabs}
          setTabs={jest.fn()}
          onDiscardTempView={mockOnDiscardTempView}
          orgSlug={'test-org'}
          router={router}
        />
      );
      await userEvent.click(screen.getByRole('tab', {name: 'Unsaved'}));
      await userEvent.click(
        await screen.findByRole('button', {name: 'Unsaved Tab Options'})
      );
      await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Discard'}));

      expect(mockOnDiscardTempView).toHaveBeenCalled();
    });

    it('should fire the onSaveTempView callback when the discard button is pressed for a temp view', async () => {
      render(
        <DraggableTabBar
          initialTabKey="1"
          setTempTab={jest.fn()}
          tabs={tabs}
          setTabs={jest.fn()}
          onSaveTempView={mockOnSaveTempView}
          orgSlug={'test-org'}
          router={router}
        />
      );
      await userEvent.click(screen.getByRole('tab', {name: 'Unsaved'}));
      await userEvent.click(
        await screen.findByRole('button', {name: 'Unsaved Tab Options'})
      );
      await userEvent.click(
        await screen.findByRole('menuitemradio', {name: 'Save View'})
      );

      expect(mockOnSaveTempView).toHaveBeenCalled();
    });

    it('should fire the onAddView callback when the add view button is pressed', async () => {
      render(
        <DraggableTabBar
          initialTabKey="1"
          setTempTab={jest.fn()}
          tabs={tabs}
          setTabs={jest.fn()}
          onAddView={mockOnAddView}
          orgSlug={'test-org'}
          router={router}
        />
      );
      await userEvent.click(screen.getByRole('button', {name: 'Add View'}));
      expect(mockOnAddView).toHaveBeenCalled();
    });
  });
});
