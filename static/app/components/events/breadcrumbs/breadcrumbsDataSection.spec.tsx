import {EventFixture} from 'sentry-fixture/event';

import {
  render,
  screen,
  userEvent,
  waitForDrawerToHide,
  within,
} from 'sentry-test/reactTestingLibrary';

import BreadcrumbsDataSection from 'sentry/components/events/breadcrumbs/breadcrumbsDataSection';
import {
  MOCK_BREADCRUMBS,
  MOCK_DATA_SECTION_PROPS,
  MOCK_EXCEPTION_ENTRY,
} from 'sentry/components/events/breadcrumbs/testUtils';
import {EntryType} from 'sentry/types/event';

// Needed to mock useVirtualizer lists.
jest.spyOn(window.Element.prototype, 'getBoundingClientRect').mockImplementation(() => ({
  x: 0,
  y: 0,
  width: 0,
  height: 30,
  left: 0,
  top: 0,
  right: 0,
  bottom: 0,
  toJSON: jest.fn(),
}));

describe('BreadcrumbsDataSection', function () {
  it('renders a summary of breadcrumbs with a button to view them all', async function () {
    render(<BreadcrumbsDataSection {...MOCK_DATA_SECTION_PROPS} />);

    // Only summary crumbs should be visible by default
    const summaryCrumbTitles = [
      'Exception',
      MOCK_BREADCRUMBS[5].category,
      MOCK_BREADCRUMBS[4].category,
      MOCK_BREADCRUMBS[3].category,
      MOCK_BREADCRUMBS[2].category,
    ];
    for (const crumbTitle of summaryCrumbTitles) {
      expect(screen.getByText(crumbTitle)).toBeInTheDocument();
    }
    const hiddenCrumbTitles = [
      MOCK_BREADCRUMBS[1].category,
      MOCK_BREADCRUMBS[0].category,
    ];
    for (const crumbTitle of hiddenCrumbTitles) {
      expect(screen.queryByText(crumbTitle)).not.toBeInTheDocument();
    }

    // When expanded, all should be visible
    const viewAllButton = screen.getByRole('button', {name: 'View All Breadcrumbs'});
    await userEvent.click(viewAllButton);
    const drawer = screen.getByRole('complementary', {name: 'breadcrumb drawer'});
    expect(drawer).toBeInTheDocument();
    for (const crumbTitle of [...summaryCrumbTitles, ...hiddenCrumbTitles]) {
      expect(within(drawer).getByText(crumbTitle)).toBeInTheDocument();
    }
  });

  it('toggles the drawer when view all is clicked', async function () {
    render(<BreadcrumbsDataSection {...MOCK_DATA_SECTION_PROPS} />);
    const viewAllButton = screen.getByRole('button', {name: 'View All Breadcrumbs'});
    await userEvent.click(viewAllButton);
    const drawer = screen.getByRole('complementary', {name: 'breadcrumb drawer'});
    expect(drawer).toBeInTheDocument();
    await userEvent.click(viewAllButton);
    await waitForDrawerToHide('breadcrumb drawer');
    expect(drawer).not.toBeInTheDocument();
  });

  it('can switch between display time formats', async function () {
    const singleCrumbEvent = EventFixture({
      entries: [
        {
          type: EntryType.BREADCRUMBS,
          data: {
            values: [MOCK_BREADCRUMBS[0]],
          },
        },
        MOCK_EXCEPTION_ENTRY,
      ],
    });
    render(
      <BreadcrumbsDataSection
        event={singleCrumbEvent}
        group={MOCK_DATA_SECTION_PROPS.group}
        project={MOCK_DATA_SECTION_PROPS.project}
      />
    );

    // From virtual crumb
    expect(screen.getByText('06:01:48.762 PM')).toBeInTheDocument();
    expect(screen.queryByText('0ms')).not.toBeInTheDocument();
    // From event breadcrumb
    expect(screen.getByText('06:00:48.760 PM')).toBeInTheDocument();
    expect(screen.queryByText('-1min 2ms')).not.toBeInTheDocument();

    const timeControl = screen.getByRole('button', {
      name: 'Change Time Format for Breadcrumbs',
    });
    await userEvent.click(timeControl);

    expect(screen.getByText('0ms')).toBeInTheDocument();
    expect(screen.queryByText('06:01:48.762 PM')).not.toBeInTheDocument();
    expect(screen.getByText('-1min 2ms')).toBeInTheDocument();
    expect(screen.queryByText('06:00:48.760 PM')).not.toBeInTheDocument();

    await userEvent.click(timeControl);

    expect(screen.queryByText('0ms')).not.toBeInTheDocument();
    expect(screen.getByText('06:01:48.762 PM')).toBeInTheDocument();
    expect(screen.queryByText('-1min 2ms')).not.toBeInTheDocument();
    expect(screen.getByText('06:00:48.760 PM')).toBeInTheDocument();
  });

  it('opens the drawer and focuses search when the search button is pressed', async function () {
    render(<BreadcrumbsDataSection {...MOCK_DATA_SECTION_PROPS} />);

    const control = screen.getByRole('button', {name: 'Open Breadcrumb Search'});
    expect(control).toBeInTheDocument();
    await userEvent.click(control);
    expect(
      screen.getByRole('complementary', {name: 'breadcrumb drawer'})
    ).toBeInTheDocument();
    const drawerControl = screen.getByRole('textbox', {
      name: 'Search All Breadcrumbs',
    });
    expect(drawerControl).toBeInTheDocument();
    expect(drawerControl).toHaveFocus();
  });
});
