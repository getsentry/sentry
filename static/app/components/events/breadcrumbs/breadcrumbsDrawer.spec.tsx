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
  return within(screen.getByRole('complementary', {name: 'breadcrumb drawer'}));
}

describe('BreadcrumbsDrawer', function () {
  it('renders the drawer as expected', async function () {
    const drawerScreen = await renderBreadcrumbDrawer();
    expect(drawerScreen.getByRole('button', {name: 'Close Drawer'})).toBeInTheDocument();

    // Inner drawer breadcrumbs
    const {event, group} = MOCK_DATA_SECTION_PROPS;
    expect(drawerScreen.getByText(group.shortId)).toBeInTheDocument();
    expect(drawerScreen.getByText(event.id.slice(0, 8))).toBeInTheDocument();
    expect(drawerScreen.getByText('Breadcrumbs', {selector: 'span'})).toBeInTheDocument();

    // Header & Controls
    expect(drawerScreen.getByText('Breadcrumbs', {selector: 'h3'})).toBeInTheDocument();
    expect(
      drawerScreen.getByRole('textbox', {name: 'Search All Breadcrumbs'})
    ).toBeInTheDocument();
    expect(
      drawerScreen.getByRole('button', {name: 'Sort All Breadcrumbs'})
    ).toBeInTheDocument();
    expect(
      drawerScreen.getByRole('button', {name: 'Filter All Breadcrumbs'})
    ).toBeInTheDocument();
    expect(
      drawerScreen.getByRole('button', {name: 'Change Time Format for All Breadcrumbs'})
    ).toBeInTheDocument();

    // Contents
    for (const {category, level, message} of MOCK_BREADCRUMBS) {
      expect(drawerScreen.getByText(category)).toBeInTheDocument();
      expect(drawerScreen.getByText(level)).toBeInTheDocument();
      expect(drawerScreen.getByText(message)).toBeInTheDocument();
    }
    expect(drawerScreen.getAllByText('06:00:48.760')).toHaveLength(
      MOCK_BREADCRUMBS.length
    );
  });

  it('allows search to affect displayed crumbs', async function () {
    const drawerScreen = await renderBreadcrumbDrawer();

    const [warningCrumb, logCrumb] = MOCK_BREADCRUMBS;
    expect(drawerScreen.getByText(warningCrumb.category)).toBeInTheDocument();
    expect(drawerScreen.getByText(logCrumb.category)).toBeInTheDocument();

    const searchInput = drawerScreen.getByRole('textbox', {
      name: 'Search All Breadcrumbs',
    });
    await userEvent.type(searchInput, warningCrumb.message);

    expect(drawerScreen.getByText(warningCrumb.category)).toBeInTheDocument();
    expect(drawerScreen.queryByText(logCrumb.category)).not.toBeInTheDocument();
  });

  it('allows type filter to affect displayed crumbs', async function () {
    const drawerScreen = await renderBreadcrumbDrawer();

    const queryCrumb = MOCK_BREADCRUMBS[3];
    const requestCrumb = MOCK_BREADCRUMBS[2];
    expect(drawerScreen.getByText(queryCrumb.category)).toBeInTheDocument();
    expect(drawerScreen.getByText(requestCrumb.category)).toBeInTheDocument();

    await userEvent.click(
      drawerScreen.getByRole('button', {name: 'Filter All Breadcrumbs'})
    );
    await userEvent.click(drawerScreen.getByRole('option', {name: 'Query'}));

    expect(drawerScreen.getByText(queryCrumb.category)).toBeInTheDocument();
    expect(drawerScreen.queryByText(requestCrumb.category)).not.toBeInTheDocument();
  });

  it('allows level spofilter to affect displayed crumbs', async function () {
    const drawerScreen = await renderBreadcrumbDrawer();

    const [warningCrumb, logCrumb] = MOCK_BREADCRUMBS;

    expect(drawerScreen.getByText(warningCrumb.category)).toBeInTheDocument();
    expect(drawerScreen.getByText(logCrumb.category)).toBeInTheDocument();

    await userEvent.click(
      drawerScreen.getByRole('button', {name: 'Filter All Breadcrumbs'})
    );
    await userEvent.click(drawerScreen.getByRole('option', {name: 'warning'}));

    expect(drawerScreen.getByText(warningCrumb.category)).toBeInTheDocument();
    expect(drawerScreen.queryByText(logCrumb.category)).not.toBeInTheDocument();
  });

  it('allows sort dropdown to affect displayed crumbs', async function () {
    const drawerScreen = await renderBreadcrumbDrawer();

    const [warningCrumb, logCrumb] = MOCK_BREADCRUMBS;

    expect(
      drawerScreen
        .getByText(warningCrumb.category)
        .compareDocumentPosition(drawerScreen.getByText(logCrumb.category))
    ).toBe(document.DOCUMENT_POSITION_PRECEDING);

    const sortControl = drawerScreen.getByRole('button', {
      name: 'Sort All Breadcrumbs',
    });
    await userEvent.click(sortControl);
    await userEvent.click(drawerScreen.getByRole('option', {name: 'Oldest'}));

    expect(
      drawerScreen
        .getByText(warningCrumb.category)
        .compareDocumentPosition(drawerScreen.getByText(logCrumb.category))
    ).toBe(document.DOCUMENT_POSITION_FOLLOWING);

    await userEvent.click(sortControl);
    await userEvent.click(drawerScreen.getByRole('option', {name: 'Newest'}));

    expect(
      drawerScreen
        .getByText(warningCrumb.category)
        .compareDocumentPosition(drawerScreen.getByText(logCrumb.category))
    ).toBe(document.DOCUMENT_POSITION_PRECEDING);
  });

  it('allows time display dropdown to change all displayed crumbs', async function () {
    const drawerScreen = await renderBreadcrumbDrawer();
    expect(drawerScreen.getAllByText('06:00:48.760')).toHaveLength(
      MOCK_BREADCRUMBS.length
    );
    expect(drawerScreen.queryByText('-1min 2ms')).not.toBeInTheDocument();
    const timeControl = drawerScreen.getByRole('button', {
      name: 'Change Time Format for All Breadcrumbs',
    });
    await userEvent.click(timeControl);
    await userEvent.click(drawerScreen.getByRole('option', {name: 'Relative'}));

    expect(drawerScreen.queryByText('06:00:48.760')).not.toBeInTheDocument();
    expect(drawerScreen.getAllByText('-1min 2ms')).toHaveLength(MOCK_BREADCRUMBS.length);

    await userEvent.click(timeControl);
    await userEvent.click(drawerScreen.getByRole('option', {name: 'Absolute'}));

    expect(drawerScreen.getAllByText('06:00:48.760')).toHaveLength(
      MOCK_BREADCRUMBS.length
    );
    expect(drawerScreen.queryByText('-1min 2ms')).not.toBeInTheDocument();
  });
});
