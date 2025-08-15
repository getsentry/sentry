import {TagsFixture} from 'sentry-fixture/tags';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {EventFeatureFlagSection} from 'sentry/components/events/featureFlags/eventFeatureFlagSection';
import {
  MOCK_DATA_SECTION_PROPS,
  MOCK_DATA_SECTION_PROPS_ONE_EXTRA_FLAG,
  MOCK_FLAGS,
} from 'sentry/components/events/featureFlags/testUtils';

async function renderFlagDrawer() {
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
  render(<EventFeatureFlagSection {...MOCK_DATA_SECTION_PROPS_ONE_EXTRA_FLAG} />);
  await userEvent.click(screen.getByRole('button', {name: 'View 1 More Flag'}));
  return screen.getByRole('complementary', {name: 'Feature flags drawer'});
}

describe('FeatureFlagDrawer', () => {
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1/events/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/flags/logs/',
      body: {data: []},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/1/tags/`,
      body: TagsFixture(),
    });
  });
  it('renders the drawer as expected', async () => {
    const drawerScreen = await renderFlagDrawer();
    expect(
      within(drawerScreen).getByRole('button', {name: 'Close Drawer'})
    ).toBeInTheDocument();

    // Inner drawer flags
    const {event, group} = MOCK_DATA_SECTION_PROPS;
    expect(within(drawerScreen).getByText(group.shortId)).toBeInTheDocument();
    expect(within(drawerScreen).getByText(event.id.slice(0, 8))).toBeInTheDocument();
    expect(
      within(drawerScreen).getByText('Feature Flags', {selector: 'span'})
    ).toBeInTheDocument();

    // Header & Controls
    expect(
      within(drawerScreen).getByText('Feature Flags', {selector: 'h3'})
    ).toBeInTheDocument();
    expect(
      within(drawerScreen).getByRole('textbox', {name: 'Search Flags'})
    ).toBeInTheDocument();
    expect(
      within(drawerScreen).getByRole('button', {name: 'Sort Flags'})
    ).toBeInTheDocument();

    // Contents
    for (const {flag, result} of MOCK_FLAGS) {
      expect(within(drawerScreen).getByText(flag)).toBeInTheDocument();
      expect(within(drawerScreen).getAllByText(result.toString())[0]).toBeInTheDocument();
    }
  });

  it('allows search to affect displayed flags', async () => {
    const drawerScreen = await renderFlagDrawer();

    const [webVitalsFlag, enableReplay] = MOCK_FLAGS.filter(f => f.result === true);
    expect(within(drawerScreen).getByText(webVitalsFlag!.flag)).toBeInTheDocument();
    expect(within(drawerScreen).getByText(enableReplay!.flag)).toBeInTheDocument();

    const searchInput = within(drawerScreen).getByRole('textbox', {
      name: 'Search Flags',
    });
    await userEvent.type(searchInput, webVitalsFlag!.flag);

    expect(within(drawerScreen).getByText(webVitalsFlag!.flag)).toBeInTheDocument();
    expect(within(drawerScreen).queryByText(enableReplay!.flag)).not.toBeInTheDocument();
  });

  it('allows sort dropdown to affect displayed flags', async () => {
    const drawerScreen = await renderFlagDrawer();

    const [webVitalsFlag, enableReplay] = MOCK_FLAGS.filter(f => f.result === true);

    // the flags are reversed by default, so webVitalsFlag should be following enableReplay
    expect(
      within(drawerScreen)
        .getByText(enableReplay!.flag)
        .compareDocumentPosition(within(drawerScreen).getByText(webVitalsFlag!.flag))
    ).toBe(document.DOCUMENT_POSITION_FOLLOWING);

    const sortControl = within(drawerScreen).getByRole('button', {
      name: 'Sort Flags',
    });
    await userEvent.click(sortControl);
    await userEvent.click(
      within(drawerScreen).getByRole('option', {name: 'Oldest First'})
    );
    await userEvent.click(sortControl); // close dropdown

    // expect webVitalsFlag to be preceding enableReplay
    expect(
      within(drawerScreen)
        .getByText(enableReplay!.flag)
        .compareDocumentPosition(within(drawerScreen).getByText(webVitalsFlag!.flag))
    ).toBe(document.DOCUMENT_POSITION_PRECEDING);

    await userEvent.click(sortControl);
    await userEvent.click(
      within(drawerScreen).getByRole('option', {name: 'Alphabetical'})
    );
    await userEvent.click(within(drawerScreen).getByRole('option', {name: 'Z-A'}));
    await userEvent.click(sortControl); // close dropdown

    // enableReplay follows webVitalsFlag in Z-A sort
    expect(
      within(drawerScreen)
        .getByText(webVitalsFlag!.flag)
        .compareDocumentPosition(within(drawerScreen).getByText(enableReplay!.flag))
    ).toBe(document.DOCUMENT_POSITION_FOLLOWING);
  });

  it('renders a sort dropdown with Evaluation Order as the default', async () => {
    const drawerScreen = await renderFlagDrawer();

    const control = within(drawerScreen).getByRole('button', {name: 'Sort Flags'});
    expect(control).toBeInTheDocument();
    await userEvent.click(control);
    expect(
      within(drawerScreen).getByRole('option', {name: 'Evaluation Order'})
    ).toBeInTheDocument();
    expect(
      within(drawerScreen).getByRole('option', {name: 'Alphabetical'})
    ).toBeInTheDocument();
  });

  it('renders a sort dropdown which affects the granular sort dropdown', async () => {
    const drawerScreen = await renderFlagDrawer();

    const control = within(drawerScreen).getByRole('button', {name: 'Sort Flags'});
    expect(control).toBeInTheDocument();
    await userEvent.click(control);
    await userEvent.click(
      within(drawerScreen).getByRole('option', {name: 'Alphabetical'})
    );
    expect(
      within(drawerScreen).getByRole('option', {name: 'Alphabetical'})
    ).toHaveAttribute('aria-selected', 'true');
    expect(within(drawerScreen).getByRole('option', {name: 'A-Z'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  it('renders a sort dropdown which hides the invalid options', async () => {
    const drawerScreen = await renderFlagDrawer();

    const control = within(drawerScreen).getByRole('button', {name: 'Sort Flags'});
    expect(control).toBeInTheDocument();
    await userEvent.click(control);
    await userEvent.click(
      within(drawerScreen).getByRole('option', {name: 'Alphabetical'})
    );
    expect(
      within(drawerScreen).getByRole('option', {name: 'Alphabetical'})
    ).toHaveAttribute('aria-selected', 'true');
    expect(
      within(drawerScreen).queryByRole('option', {name: 'Newest First'})
    ).not.toBeInTheDocument();
    expect(
      within(drawerScreen).queryByRole('option', {name: 'Oldest First'})
    ).not.toBeInTheDocument();

    await userEvent.click(
      within(drawerScreen).getByRole('option', {name: 'Evaluation Order'})
    );
    expect(
      within(drawerScreen).getByRole('option', {name: 'Evaluation Order'})
    ).toHaveAttribute('aria-selected', 'true');
    expect(
      within(drawerScreen).queryByRole('option', {name: 'Z-A'})
    ).not.toBeInTheDocument();
    expect(
      within(drawerScreen).queryByRole('option', {name: 'A-Z'})
    ).not.toBeInTheDocument();
  });
});
