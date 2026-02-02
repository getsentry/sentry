import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import {setWindowLocation} from 'sentry-test/utils';

import {Button} from '@sentry/scraps/button';

import {trackAnalytics} from 'sentry/utils/analytics';
import localStorageWrapper from 'sentry/utils/localStorage';
import {SectionKey, useIssueDetails} from 'sentry/views/issueDetails/streamline/context';
import {
  FoldSection,
  getFoldSectionKey,
} from 'sentry/views/issueDetails/streamline/foldSection';

// Mock dependencies
jest.mock('sentry/views/issueDetails/streamline/context');
jest.mock('sentry/utils/analytics', () => ({
  trackAnalytics: jest.fn(),
}));

describe('FoldSection', () => {
  const mockUseIssueDetails = {
    sectionData: {},
    detectorDetails: {},
    eventCount: 0,
    isSidebarOpen: true,
    navScrollMargin: 64,
    dispatch: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();
    localStorageWrapper.clear();
    jest.mocked(useIssueDetails).mockReturnValue(mockUseIssueDetails);
  });

  describe('Basic rendering', () => {
    it('renders with title and children', () => {
      render(
        <FoldSection title="Test Section" sectionKey={SectionKey.HIGHLIGHTS}>
          <div>Test Content</div>
        </FoldSection>,
        {
          organization: OrganizationFixture(),
        }
      );

      expect(screen.getByText('Test Section')).toBeVisible();
      expect(screen.getByText('Test Content')).toBeVisible();
    });

    it('renders with custom JSX title', () => {
      render(
        <FoldSection title={<span>Custom Title</span>} sectionKey={SectionKey.HIGHLIGHTS}>
          <div>Test Content</div>
        </FoldSection>,
        {
          organization: OrganizationFixture(),
        }
      );

      expect(screen.getByText('Custom Title')).toBeVisible();
    });

    it('applies accessibility attributes to container', () => {
      render(
        <FoldSection title="Test Section" sectionKey={SectionKey.HIGHLIGHTS}>
          <div>Test Content</div>
        </FoldSection>,
        {
          organization: OrganizationFixture(),
        }
      );

      const section = screen.getByTestId('highlights');
      expect(section).toBeVisible();
      expect(section).toHaveAttribute('id', 'highlights');

      const expandButton = screen.getByRole('button');
      expect(expandButton).toHaveAttribute('aria-expanded', 'true');
      expect(expandButton).toHaveAttribute('aria-label', 'Collapse Test Section Section');
    });

    it('renders with additional identifier', () => {
      render(
        <FoldSection
          title="Test Section"
          sectionKey={SectionKey.HIGHLIGHTS}
          additionalIdentifier="-extra"
        >
          <div>Test Content</div>
        </FoldSection>,
        {
          organization: OrganizationFixture(),
        }
      );

      expect(screen.getByTestId('highlights-extra')).toHaveAttribute(
        'id',
        'highlights-extra'
      );
    });
  });

  describe('Collapse/Expand functionality', () => {
    it('starts expanded by default', () => {
      render(
        <FoldSection title="Test Section" sectionKey={SectionKey.HIGHLIGHTS}>
          <div>Test Content</div>
        </FoldSection>,
        {
          organization: OrganizationFixture(),
        }
      );

      expect(screen.getByTestId('highlights')).toBeVisible();
      expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
    });

    it('can be collapsed and expanded by clicking', async () => {
      render(
        <FoldSection title="Test Section" sectionKey={SectionKey.HIGHLIGHTS}>
          <div>Test Content</div>
        </FoldSection>,
        {
          organization: OrganizationFixture(),
        }
      );

      const expandButton = screen.getByRole('button');

      // Initially expanded
      expect(screen.getByText('Test Content')).toBeVisible();

      // Click to collapse
      await userEvent.click(expandButton);
      expect(screen.queryByText('Test Content')).not.toBeInTheDocument();
      expect(expandButton).toHaveAttribute('aria-expanded', 'false');
      expect(expandButton).toHaveAttribute('aria-label', 'View Test Section Section');

      // Click to expand
      await userEvent.click(expandButton);
      expect(screen.getByText('Test Content')).toBeVisible();
      expect(expandButton).toHaveAttribute('aria-expanded', 'true');
      expect(expandButton).toHaveAttribute('aria-label', 'Collapse Test Section Section');
    });

    it('starts collapsed when initialCollapse is true', () => {
      render(
        <FoldSection
          title="Test Section"
          sectionKey={SectionKey.HIGHLIGHTS}
          initialCollapse
        >
          <div>Test Content</div>
        </FoldSection>,
        {
          organization: OrganizationFixture(),
        }
      );

      expect(screen.queryByText('Test Content')).not.toBeInTheDocument();
      expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false');
    });

    it('tracks analytics when toggling', async () => {
      render(
        <FoldSection title="Test Section" sectionKey={SectionKey.HIGHLIGHTS}>
          <div>Test Content</div>
        </FoldSection>,
        {
          organization: OrganizationFixture(),
        }
      );

      const expandButton = screen.getByRole('button');
      await userEvent.click(expandButton);

      expect(trackAnalytics).toHaveBeenCalledWith('issue_details.section_fold', {
        sectionKey: 'highlights',
        organization: expect.any(Object),
        open: true, // Component tracks the current state BEFORE toggle (was open)
        org_streamline_only: true,
      });
    });
  });

  describe('Prevent collapse functionality', () => {
    it('cannot be collapsed when preventCollapse is true', () => {
      render(
        <FoldSection
          title="Test Section"
          sectionKey={SectionKey.HIGHLIGHTS}
          preventCollapse
        >
          <div>Test Content</div>
        </FoldSection>,
        {
          organization: OrganizationFixture(),
        }
      );

      // Button exists but should not be functional when preventCollapse is true
      const button = screen.getByRole('button');
      expect(button).toBeVisible();
      expect(screen.getByText('Test Content')).toBeVisible();

      // Content should always be visible when preventCollapse is true
      expect(screen.getByText('Test Content')).toBeVisible();
    });

    it('forces expanded state when preventCollapse is enabled', () => {
      // Start with collapsed state in localStorage
      localStorageWrapper.setItem(getFoldSectionKey(SectionKey.HIGHLIGHTS), 'true');

      render(
        <FoldSection
          title="Test Section"
          sectionKey={SectionKey.HIGHLIGHTS}
          preventCollapse
        >
          <div>Test Content</div>
        </FoldSection>,
        {
          organization: OrganizationFixture(),
        }
      );

      // Should be expanded despite localStorage value
      expect(screen.getByText('Test Content')).toBeVisible();
    });
  });

  describe('Actions', () => {
    it('shows actions only when expanded', () => {
      render(
        <FoldSection
          title="Test Section"
          sectionKey={SectionKey.HIGHLIGHTS}
          actions={<Button size="xs">Test Action</Button>}
        >
          <div>Test Content</div>
        </FoldSection>,
        {
          organization: OrganizationFixture(),
        }
      );

      // Actions visible when expanded
      expect(screen.getByRole('button', {name: 'Test Action'})).toBeVisible();
    });

    it('hides actions when collapsed', async () => {
      render(
        <FoldSection
          title="Test Section"
          sectionKey={SectionKey.HIGHLIGHTS}
          actions={<Button size="xs">Test Action</Button>}
        >
          <div>Test Content</div>
        </FoldSection>,
        {
          organization: OrganizationFixture(),
        }
      );

      // Collapse the section
      await userEvent.click(screen.getByRole('button', {name: /Collapse/}));

      // Actions should be hidden
      expect(screen.queryByRole('button', {name: 'Test Action'})).not.toBeInTheDocument();
    });

    it('prevents event propagation when clicking actions', async () => {
      const onActionClick = jest.fn();

      render(
        <FoldSection
          title="Test Section"
          sectionKey={SectionKey.HIGHLIGHTS}
          actions={
            <Button size="xs" onClick={onActionClick}>
              Test Action
            </Button>
          }
        >
          <div>Test Content</div>
        </FoldSection>,
        {
          organization: OrganizationFixture(),
        }
      );

      // Click the action button
      await userEvent.click(screen.getByRole('button', {name: 'Test Action'}));

      // Action handler should be called
      expect(onActionClick).toHaveBeenCalled();

      // Section should still be expanded (click didn't propagate)
      expect(screen.getByText('Test Content')).toBeVisible();
    });
  });

  describe('LocalStorage persistence', () => {
    it('persists collapse state to localStorage', async () => {
      render(
        <FoldSection title="Test Section" sectionKey={SectionKey.HIGHLIGHTS}>
          <div>Test Content</div>
        </FoldSection>,
        {
          organization: OrganizationFixture(),
        }
      );

      // Collapse section
      await userEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(
          localStorageWrapper.getItem(getFoldSectionKey(SectionKey.HIGHLIGHTS))
        ).toBe('true');
      });
    });

    it('loads initial state from localStorage', () => {
      // Set collapsed state in localStorage
      localStorageWrapper.setItem(getFoldSectionKey(SectionKey.HIGHLIGHTS), 'true');

      render(
        <FoldSection title="Test Section" sectionKey={SectionKey.HIGHLIGHTS}>
          <div>Test Content</div>
        </FoldSection>
      );

      // Should start collapsed
      expect(screen.queryByText('Test Content')).not.toBeInTheDocument();
    });

    it('does not persist state when disableCollapsePersistence is true', async () => {
      render(
        <FoldSection
          title="Test Section"
          sectionKey={SectionKey.HIGHLIGHTS}
          disableCollapsePersistence
        >
          <div>Test Content</div>
        </FoldSection>,
        {
          organization: OrganizationFixture(),
        }
      );

      // Collapse section
      await userEvent.click(screen.getByRole('button'));

      // Wait and verify localStorage was not updated
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(
        localStorageWrapper.getItem(getFoldSectionKey(SectionKey.HIGHLIGHTS))
      ).toBeNull();
    });
  });

  describe('URL hash navigation', () => {
    beforeEach(() => {
      Element.prototype.scrollIntoView = jest.fn();
      setWindowLocation(
        'http://localhost:3000/organizations/test-org/issues/123#highlights'
      );
    });

    it('provides scroll functionality when element and navScrollMargin are available', async () => {
      render(
        <FoldSection title="Test Section" sectionKey={SectionKey.HIGHLIGHTS}>
          <div>Test Content</div>
        </FoldSection>
      );

      const section = screen.getByTestId('highlights');
      expect(section).toHaveAttribute('id', 'highlights');
      await waitFor(() => {
        expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
      });
    });
  });

  describe('Context integration', () => {
    it('updates context on mount', () => {
      render(
        <FoldSection
          title="Test Section"
          sectionKey={SectionKey.HIGHLIGHTS}
          initialCollapse
        >
          <div>Test Content</div>
        </FoldSection>,
        {
          organization: OrganizationFixture(),
        }
      );

      expect(mockUseIssueDetails.dispatch).toHaveBeenCalledWith({
        type: 'UPDATE_EVENT_SECTION',
        key: 'highlights',
        config: {initialCollapse: true},
      });
    });

    it('does not update context if section already exists', () => {
      jest.mocked(useIssueDetails).mockReturnValue({
        ...mockUseIssueDetails,
        sectionData: {
          [SectionKey.HIGHLIGHTS]: {key: SectionKey.HIGHLIGHTS},
        },
      });

      render(
        <FoldSection title="Test Section" sectionKey={SectionKey.HIGHLIGHTS}>
          <div>Test Content</div>
        </FoldSection>,
        {
          organization: OrganizationFixture(),
        }
      );

      expect(mockUseIssueDetails.dispatch).not.toHaveBeenCalled();
    });

    it('uses correct initialCollapse value when preventCollapse is true', () => {
      render(
        <FoldSection
          title="Test Section"
          sectionKey={SectionKey.HIGHLIGHTS}
          initialCollapse
          preventCollapse
        >
          <div>Test Content</div>
        </FoldSection>,
        {
          organization: OrganizationFixture(),
        }
      );

      expect(mockUseIssueDetails.dispatch).toHaveBeenCalledWith({
        type: 'UPDATE_EVENT_SECTION',
        key: 'highlights',
        config: {initialCollapse: false}, // Should override initialCollapse when preventCollapse is true
      });
    });
  });
});
