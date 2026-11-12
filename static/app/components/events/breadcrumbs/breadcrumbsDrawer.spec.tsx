import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {getShortEventId} from 'sentry/utils/events';
import {mockElementSize} from 'sentry/utils/fixtures/virtualization';

import {BreadcrumbsDataSection} from './breadcrumbsDataSection';
import {MOCK_BREADCRUMBS, MOCK_DATA_SECTION_PROPS} from './testUtils';

async function openBreadcrumbDrawer() {
  mockElementSize({width: 0, height: 30});
  render(<BreadcrumbsDataSection {...MOCK_DATA_SECTION_PROPS} />);
  await userEvent.click(screen.getByRole('button', {name: 'View 2 more'}));
  return screen.getByRole('complementary', {name: 'breadcrumb drawer'});
}

describe('BreadcrumbsDrawer', () => {
  it('renders the drawer as expected', async () => {
    const drawerScreen = await openBreadcrumbDrawer();
    expect(
      within(drawerScreen).getByRole('button', {name: 'Close Drawer'})
    ).toBeInTheDocument();

    // Inner drawer breadcrumbs
    const {event} = MOCK_DATA_SECTION_PROPS;
    const currentCrumb = within(drawerScreen).getByText('Breadcrumbs');
    expect(currentCrumb).toHaveAttribute('aria-current', 'location');
    await userEvent.hover(currentCrumb);
    expect(
      await screen.findByText(`Event ID: ${getShortEventId(event.id)}`)
    ).toBeInTheDocument();

    // Controls
    expect(
      within(drawerScreen).getByRole('textbox', {name: 'Search All Breadcrumbs'})
    ).toBeInTheDocument();
    expect(
      within(drawerScreen).getByRole('button', {name: 'Sort All Breadcrumbs'})
    ).toBeInTheDocument();
    expect(
      within(drawerScreen).getByRole('button', {name: 'Filter All Breadcrumbs'})
    ).toBeInTheDocument();
    expect(
      within(drawerScreen).getByRole('button', {
        name: 'Change Time Format for All Breadcrumbs',
      })
    ).toBeInTheDocument();

    // Contents
    for (const {category, level, message} of MOCK_BREADCRUMBS) {
      expect(within(drawerScreen).getByText(category)).toBeInTheDocument();
      expect(within(drawerScreen).getByText(level)).toBeInTheDocument();
      expect(within(drawerScreen).getByText(message)).toBeInTheDocument();
    }
    expect(
      within(drawerScreen).getAllByText('May 21, 2019 6:00:48.760 PM UTC')
    ).toHaveLength(MOCK_BREADCRUMBS.length);
  });

  it('allows search to affect displayed crumbs', async () => {
    const drawerScreen = await openBreadcrumbDrawer();

    const [warningCrumb, logCrumb] = MOCK_BREADCRUMBS;
    expect(within(drawerScreen).getByText(warningCrumb.category)).toBeInTheDocument();
    expect(within(drawerScreen).getByText(logCrumb.category)).toBeInTheDocument();

    const searchInput = within(drawerScreen).getByRole('textbox', {
      name: 'Search All Breadcrumbs',
    });
    await userEvent.type(searchInput, warningCrumb.message);

    expect(within(drawerScreen).getByText(warningCrumb.category)).toBeInTheDocument();
    expect(within(drawerScreen).queryByText(logCrumb.category)).not.toBeInTheDocument();
  });

  it('allows type filter to affect displayed crumbs', async () => {
    const drawerScreen = await openBreadcrumbDrawer();

    const queryCrumb = MOCK_BREADCRUMBS[3];
    const requestCrumb = MOCK_BREADCRUMBS[2];
    expect(within(drawerScreen).getByText(queryCrumb.category)).toBeInTheDocument();
    expect(within(drawerScreen).getByText(requestCrumb.category)).toBeInTheDocument();

    await userEvent.click(
      within(drawerScreen).getByRole('button', {name: 'Filter All Breadcrumbs'})
    );
    await userEvent.click(within(drawerScreen).getByRole('option', {name: 'Query'}));

    expect(within(drawerScreen).getByText(queryCrumb.category)).toBeInTheDocument();
    expect(
      within(drawerScreen).queryByText(requestCrumb.category)
    ).not.toBeInTheDocument();
  });

  it('allows level spofilter to affect displayed crumbs', async () => {
    const drawerScreen = await openBreadcrumbDrawer();

    const [warningCrumb, logCrumb] = MOCK_BREADCRUMBS;

    expect(within(drawerScreen).getByText(warningCrumb.category)).toBeInTheDocument();
    expect(within(drawerScreen).getByText(logCrumb.category)).toBeInTheDocument();

    await userEvent.click(
      within(drawerScreen).getByRole('button', {name: 'Filter All Breadcrumbs'})
    );
    await userEvent.click(within(drawerScreen).getByRole('option', {name: 'warning'}));

    expect(within(drawerScreen).getByText(warningCrumb.category)).toBeInTheDocument();
    expect(within(drawerScreen).queryByText(logCrumb.category)).not.toBeInTheDocument();
  });

  it('allows sort dropdown to affect displayed crumbs', async () => {
    const drawerScreen = await openBreadcrumbDrawer();

    const [warningCrumb, logCrumb] = MOCK_BREADCRUMBS;

    expect(
      within(drawerScreen)
        .getByText(warningCrumb.category)
        .compareDocumentPosition(within(drawerScreen).getByText(logCrumb.category))
    ).toBe(document.DOCUMENT_POSITION_PRECEDING);

    const sortControl = within(drawerScreen).getByRole('button', {
      name: 'Sort All Breadcrumbs',
    });
    await userEvent.click(sortControl);
    await userEvent.click(within(drawerScreen).getByRole('option', {name: 'Oldest'}));

    expect(
      within(drawerScreen)
        .getByText(warningCrumb.category)
        .compareDocumentPosition(within(drawerScreen).getByText(logCrumb.category))
    ).toBe(document.DOCUMENT_POSITION_FOLLOWING);

    await userEvent.click(sortControl);
    await userEvent.click(within(drawerScreen).getByRole('option', {name: 'Newest'}));

    expect(
      within(drawerScreen)
        .getByText(warningCrumb.category)
        .compareDocumentPosition(within(drawerScreen).getByText(logCrumb.category))
    ).toBe(document.DOCUMENT_POSITION_PRECEDING);
  });

  it('allows time display dropdown to change all displayed crumbs', async () => {
    const drawerScreen = await openBreadcrumbDrawer();
    expect(
      within(drawerScreen).getAllByText('May 21, 2019 6:00:48.760 PM UTC')
    ).toHaveLength(MOCK_BREADCRUMBS.length);
    expect(within(drawerScreen).queryByText('-1min 2ms')).not.toBeInTheDocument();
    const timeControl = within(drawerScreen).getByRole('button', {
      name: 'Change Time Format for All Breadcrumbs',
    });
    await userEvent.click(timeControl);
    await userEvent.click(within(drawerScreen).getByRole('option', {name: 'Relative'}));

    expect(
      within(drawerScreen).queryByText('May 21, 2019 6:00:48.760 PM UTC')
    ).not.toBeInTheDocument();
    expect(within(drawerScreen).getAllByText('-1min 2ms')).toHaveLength(
      MOCK_BREADCRUMBS.length
    );

    await userEvent.click(timeControl);
    await userEvent.click(within(drawerScreen).getByRole('option', {name: 'Absolute'}));

    expect(
      within(drawerScreen).getAllByText('May 21, 2019 6:00:48.760 PM UTC')
    ).toHaveLength(MOCK_BREADCRUMBS.length);
    expect(within(drawerScreen).queryByText('-1min 2ms')).not.toBeInTheDocument();
  });
});
