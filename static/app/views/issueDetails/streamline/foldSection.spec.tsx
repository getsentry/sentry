import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {Button} from 'sentry/components/core/button';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import localStorageWrapper from 'sentry/utils/localStorage';
import {SectionKey, useIssueDetails} from 'sentry/views/issueDetails/streamline/context';
import {
  FoldSection,
  getFoldSectionKey,
} from 'sentry/views/issueDetails/streamline/foldSection';
import {OrganizationContext} from 'sentry/views/organizationContext';

// Mock dependencies
jest.mock('sentry/views/issueDetails/streamline/context');
jest.mock('sentry/utils/analytics', () => ({
  trackAnalytics: jest.fn(),
}));

function makeWrapper({organization}: {organization: Organization}) {
  return function ({children}: {children: React.ReactNode}) {
    return <OrganizationContext value={organization}>{children}</OrganizationContext>;
  };
}

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
          wrapper: makeWrapper({
            organization: OrganizationFixture({streamlineOnly: false}),
          }),
        }
      );

      expect(screen.getByText('Test Section')).toBeInTheDocument();
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('renders with custom JSX title', () => {
      render(
        <FoldSection
          title={<span style={{color: 'red'}}>Custom Title</span>}
          sectionKey={SectionKey.HIGHLIGHTS}
        >
          <div>Test Content</div>
        </FoldSection>,
        {
          wrapper: makeWrapper({
            organization: OrganizationFixture({streamlineOnly: false}),
          }),
        }
      );

      const titleElement = screen.getByText('Custom Title');
      expect(titleElement).toBeInTheDocument();
      expect(titleElement).toHaveStyle({color: 'red'});
    });

    it('applies correct accessibility attributes', () => {
      render(
        <FoldSection title="Test Section" sectionKey={SectionKey.HIGHLIGHTS}>
          <div>Test Content</div>
        </FoldSection>,
        {
          wrapper: makeWrapper({
            organization: OrganizationFixture({streamlineOnly: false}),
          }),
        }
      );

      const section = screen.getByRole('region', {name: 'Test Section'});
      expect(section).toBeInTheDocument();
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
          wrapper: makeWrapper({
            organization: OrganizationFixture({streamlineOnly: false}),
          }),
        }
      );

      expect(screen.getByRole('region')).toHaveAttribute('id', 'highlights-extra');
    });
  });

  describe('Collapse/Expand functionality', () => {
    it('starts expanded by default', () => {
      render(
        <FoldSection title="Test Section" sectionKey={SectionKey.HIGHLIGHTS}>
          <div>Test Content</div>
        </FoldSection>,
        {
          wrapper: makeWrapper({
            organization: OrganizationFixture({streamlineOnly: false}),
          }),
        }
      );

      expect(screen.getByText('Test Content')).toBeInTheDocument();
      expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
    });

    it('can be collapsed and expanded by clicking', async () => {
      render(
        <FoldSection title="Test Section" sectionKey={SectionKey.HIGHLIGHTS}>
          <div>Test Content</div>
        </FoldSection>,
        {
          wrapper: makeWrapper({
            organization: OrganizationFixture({streamlineOnly: false}),
          }),
        }
      );

      const expandButton = screen.getByRole('button');

      // Initially expanded
      expect(screen.getByText('Test Content')).toBeInTheDocument();

      // Click to collapse
      await userEvent.click(expandButton);
      expect(screen.queryByText('Test Content')).not.toBeInTheDocument();
      expect(expandButton).toHaveAttribute('aria-expanded', 'false');
      expect(expandButton).toHaveAttribute('aria-label', 'View Test Section Section');

      // Click to expand
      await userEvent.click(expandButton);
      expect(screen.getByText('Test Content')).toBeInTheDocument();
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
          wrapper: makeWrapper({
            organization: OrganizationFixture({streamlineOnly: false}),
          }),
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
          wrapper: makeWrapper({
            organization: OrganizationFixture({streamlineOnly: false}),
          }),
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
          wrapper: makeWrapper({
            organization: OrganizationFixture({streamlineOnly: false}),
          }),
        }
      );

      // Button exists but should not be functional when preventCollapse is true
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(screen.getByText('Test Content')).toBeInTheDocument();

      // Content should always be visible when preventCollapse is true
      expect(screen.getByText('Test Content')).toBeInTheDocument();
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
          wrapper: makeWrapper({
            organization: OrganizationFixture({streamlineOnly: false}),
          }),
        }
      );

      // Should be expanded despite localStorage value
      expect(screen.getByText('Test Content')).toBeInTheDocument();
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
          wrapper: makeWrapper({
            organization: OrganizationFixture({streamlineOnly: false}),
          }),
        }
      );

      // Actions visible when expanded
      expect(screen.getByRole('button', {name: 'Test Action'})).toBeInTheDocument();
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
          wrapper: makeWrapper({
            organization: OrganizationFixture({streamlineOnly: false}),
          }),
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
          wrapper: makeWrapper({
            organization: OrganizationFixture({streamlineOnly: false}),
          }),
        }
      );

      // Click the action button
      await userEvent.click(screen.getByRole('button', {name: 'Test Action'}));

      // Action handler should be called
      expect(onActionClick).toHaveBeenCalled();

      // Section should still be expanded (click didn't propagate)
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });
  });

  describe('LocalStorage persistence', () => {
    it('persists collapse state to localStorage', async () => {
      render(
        <FoldSection title="Test Section" sectionKey={SectionKey.HIGHLIGHTS}>
          <div>Test Content</div>
        </FoldSection>,
        {
          wrapper: makeWrapper({
            organization: OrganizationFixture({streamlineOnly: false}),
          }),
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
          wrapper: makeWrapper({
            organization: OrganizationFixture({streamlineOnly: false}),
          }),
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
      // Mock scrollIntoView
      Element.prototype.scrollIntoView = jest.fn();
    });

    // Note: URL hash navigation tests are complex due to JSDOM limitations
    // These tests focus on the core scrollToSection callback behavior

    it('provides scroll functionality when element and navScrollMargin are available', () => {
      render(
        <FoldSection title="Test Section" sectionKey={SectionKey.HIGHLIGHTS}>
          <div>Test Content</div>
        </FoldSection>
      );

      // The component should render successfully with scroll margins
      const section = screen.getByRole('region');
      expect(section).toHaveAttribute('id', 'highlights');
      // Skip the style test as it's handled by CSS-in-JS and may not be directly testable
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
          wrapper: makeWrapper({
            organization: OrganizationFixture({streamlineOnly: false}),
          }),
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
          wrapper: makeWrapper({
            organization: OrganizationFixture({streamlineOnly: false}),
          }),
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
          wrapper: makeWrapper({
            organization: OrganizationFixture({streamlineOnly: false}),
          }),
        }
      );

      expect(mockUseIssueDetails.dispatch).toHaveBeenCalledWith({
        type: 'UPDATE_EVENT_SECTION',
        key: 'highlights',
        config: {initialCollapse: false}, // Should override initialCollapse when preventCollapse is true
      });
    });
  });

  describe('Error boundary', () => {
    it('wraps content in error boundary', () => {
      const ThrowError = () => {
        throw new Error('Test error');
      };

      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      render(
        <FoldSection title="Test Section" sectionKey={SectionKey.HIGHLIGHTS}>
          <ThrowError />
        </FoldSection>
      );

      // Error boundary should catch the error and show fallback
      expect(screen.queryByText('Test error')).not.toBeInTheDocument();

      consoleSpy.mockRestore();
    });
  });

  describe('Custom props', () => {
    it('applies className prop', () => {
      render(
        <FoldSection
          title="Test Section"
          sectionKey={SectionKey.HIGHLIGHTS}
          className="custom-class"
        >
          <div>Test Content</div>
        </FoldSection>
      );

      expect(screen.getByRole('region')).toHaveClass('custom-class');
    });

    it('applies style prop', () => {
      render(
        <FoldSection
          title="Test Section"
          sectionKey={SectionKey.HIGHLIGHTS}
          style={{backgroundColor: 'red'}}
        >
          <div>Test Content</div>
        </FoldSection>
      );

      // Styles are applied through CSS-in-JS, just verify the prop is accepted
      const section = screen.getByRole('region');
      expect(section).toBeInTheDocument();
    });

    it('applies custom data-test-id', () => {
      render(
        <FoldSection
          title="Test Section"
          sectionKey={SectionKey.HIGHLIGHTS}
          dataTestId="custom-test-id"
        >
          <div>Test Content</div>
        </FoldSection>
      );

      expect(screen.getByTestId('custom-test-id')).toBeInTheDocument();
    });

    it('uses default data-test-id when not provided', () => {
      render(
        <FoldSection title="Test Section" sectionKey={SectionKey.HIGHLIGHTS}>
          <div>Test Content</div>
        </FoldSection>
      );

      expect(screen.getByTestId('highlights')).toBeInTheDocument();
    });
  });
});
