import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import BreadcrumbsDataSection from 'sentry/components/events/breadcrumbs/breadcrumbsDataSection';
import {
  MOCK_BREADCRUMBS,
  MOCK_DATA_SECTION_PROPS,
} from 'sentry/components/events/breadcrumbs/testUtils';

async function renderBreadcrumbDrawer() {
  // Needed to mock useVirtualizer lists.
  jest
    .spyOn(window.Element.prototype, 'getBoundingClientRect')
    .mockImplementation(() => ({
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
  render(<BreadcrumbsDataSection {...MOCK_DATA_SECTION_PROPS} />);
  await userEvent.click(screen.getByRole('button', {name: 'View All Breadcrumbs'}));
  return screen.getByRole('complementary', {name: 'breadcrumb drawer'});
}

describe('BreadcrumbsDrawer', function () {
  it('renders the drawer as expected', async function () {
    const drawerScreen = await renderBreadcrumbDrawer();
    expect(
      within(drawerScreen).getByRole('button', {name: 'Close Drawer'})
    ).toBeInTheDocument();

    // Inner drawer breadcrumbs
    const {event, group} = MOCK_DATA_SECTION_PROPS;
    expect(within(drawerScreen).getByText(group.shortId)).toBeInTheDocument();
    expect(within(drawerScreen).getByText(event.id.slice(0, 8))).toBeInTheDocument();
    expect(
      within(drawerScreen).getByText('Breadcrumbs', {selector: 'span'})
    ).toBeInTheDocument();

    // Header & Controls
    expect(
      within(drawerScreen).getByText('Breadcrumbs', {selector: 'h3'})
    ).toBeInTheDocument();
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
    expect(within(drawerScreen).getAllByText('06:00:48.760 PM')).toHaveLength(
      MOCK_BREADCRUMBS.length
    );
  });

  it('allows search to affect displayed crumbs', async function () {
    const drawerScreen = await renderBreadcrumbDrawer();

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

  it('allows type filter to affect displayed crumbs', async function () {
    const drawerScreen = await renderBreadcrumbDrawer();

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

  it('allows level spofilter to affect displayed crumbs', async function () {
    const drawerScreen = await renderBreadcrumbDrawer();

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

  it('allows sort dropdown to affect displayed crumbs', async function () {
    const drawerScreen = await renderBreadcrumbDrawer();

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

  it('allows time display dropdown to change all displayed crumbs', async function () {
    const drawerScreen = await renderBreadcrumbDrawer();
    expect(within(drawerScreen).getAllByText('06:00:48.760 PM')).toHaveLength(
      MOCK_BREADCRUMBS.length
    );
    expect(within(drawerScreen).queryByText('-1min 2ms')).not.toBeInTheDocument();
    const timeControl = within(drawerScreen).getByRole('button', {
      name: 'Change Time Format for All Breadcrumbs',
    });
    await userEvent.click(timeControl);
    await userEvent.click(within(drawerScreen).getByRole('option', {name: 'Relative'}));

    expect(within(drawerScreen).queryByText('06:00:48.760 PM')).not.toBeInTheDocument();
    expect(within(drawerScreen).getAllByText('-1min 2ms')).toHaveLength(
      MOCK_BREADCRUMBS.length
    );

    await userEvent.click(timeControl);
    await userEvent.click(within(drawerScreen).getByRole('option', {name: 'Absolute'}));

    expect(within(drawerScreen).getAllByText('06:00:48.760 PM')).toHaveLength(
      MOCK_BREADCRUMBS.length
    );
    expect(within(drawerScreen).queryByText('-1min 2ms')).not.toBeInTheDocument();
  });
});
