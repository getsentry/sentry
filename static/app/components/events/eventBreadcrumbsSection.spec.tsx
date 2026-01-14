import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {
  MOCK_BREADCRUMBS,
  MOCK_DATA_SECTION_PROPS,
} from 'sentry/components/events/breadcrumbs/testUtils';
import {EventBreadcrumbsSection} from 'sentry/components/events/eventBreadcrumbsSection';

// Needed to mock useVirtualizer lists.
jest.spyOn(window.Element.prototype, 'getBoundingClientRect').mockImplementation(() => ({
  x: 0,
  y: 0,
  width: 500,
  height: 400,
  left: 0,
  top: 0,
  right: 500,
  bottom: 400,
  toJSON: jest.fn(),
}));

describe('EventBreadcrumbsSection', () => {
  it('renders breadcrumbs from the event', async () => {
    render(<EventBreadcrumbsSection event={MOCK_DATA_SECTION_PROPS.event} />);

    expect(screen.getByText('Breadcrumbs')).toBeInTheDocument();
    // Verify breadcrumb categories from mock data are rendered
    expect(await screen.findByText(MOCK_BREADCRUMBS[0].category)).toBeInTheDocument();
    expect(screen.getByText(MOCK_BREADCRUMBS[1].category)).toBeInTheDocument();
  });

  it('filters breadcrumbs by type', async () => {
    render(<EventBreadcrumbsSection event={MOCK_DATA_SECTION_PROPS.event} />);

    // Multiple breadcrumbs visible initially
    expect(await screen.findByText(MOCK_BREADCRUMBS[0].category)).toBeInTheDocument();
    expect(screen.getByText(MOCK_BREADCRUMBS[2].category)).toBeInTheDocument();

    // Open filter dropdown and select Navigation type
    const filterButton = screen.getByRole('button', {name: 'Filter Breadcrumbs'});
    await userEvent.click(filterButton);
    await userEvent.click(screen.getByRole('option', {name: 'Navigation'}));

    // Close dropdown
    await userEvent.keyboard('{Escape}');

    // Only navigation breadcrumb should be visible (index 2 has type NAVIGATION)
    expect(screen.queryByText(MOCK_BREADCRUMBS[0].category)).not.toBeInTheDocument();
    expect(screen.getByText(MOCK_BREADCRUMBS[2].category)).toBeInTheDocument();
  });
});
