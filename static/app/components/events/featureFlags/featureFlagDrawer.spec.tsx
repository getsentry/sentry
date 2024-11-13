import {TagsFixture} from 'sentry-fixture/tags';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {EventFeatureFlagList} from 'sentry/components/events/featureFlags/eventFeatureFlagList';
import {
  MOCK_DATA_SECTION_PROPS,
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
  render(<EventFeatureFlagList {...MOCK_DATA_SECTION_PROPS} />);
  await userEvent.click(screen.getByRole('button', {name: 'View All'}));
  return within(screen.getByRole('complementary', {name: 'Feature flags drawer'}));
}

describe('FeatureFlagDrawer', function () {
  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/1/tags/`,
      body: TagsFixture(),
    });
  });
  it('renders the drawer as expected', async function () {
    const drawerScreen = await renderFlagDrawer();
    expect(drawerScreen.getByRole('button', {name: 'Close Drawer'})).toBeInTheDocument();

    // Inner drawer flags
    const {event, group} = MOCK_DATA_SECTION_PROPS;
    expect(drawerScreen.getByText(group.shortId)).toBeInTheDocument();
    expect(drawerScreen.getByText(event.id.slice(0, 8))).toBeInTheDocument();
    expect(
      drawerScreen.getByText('Feature Flags', {selector: 'span'})
    ).toBeInTheDocument();

    // Header & Controls
    expect(drawerScreen.getByText('Feature Flags', {selector: 'h3'})).toBeInTheDocument();
    expect(drawerScreen.getByRole('textbox', {name: 'Search Flags'})).toBeInTheDocument();
    expect(drawerScreen.getByRole('button', {name: 'Sort Flags'})).toBeInTheDocument();

    // Contents
    for (const {flag, result} of MOCK_FLAGS) {
      expect(drawerScreen.getByText(flag)).toBeInTheDocument();
      expect(drawerScreen.getAllByText(result.toString())[0]).toBeInTheDocument();
    }
  });

  it('allows search to affect displayed flags', async function () {
    const drawerScreen = await renderFlagDrawer();

    const [webVitalsFlag, enableReplay] = MOCK_FLAGS.filter(f => f.result === true);
    expect(drawerScreen.getByText(webVitalsFlag.flag)).toBeInTheDocument();
    expect(drawerScreen.getByText(enableReplay.flag)).toBeInTheDocument();

    const searchInput = drawerScreen.getByRole('textbox', {
      name: 'Search Flags',
    });
    await userEvent.type(searchInput, webVitalsFlag.flag);

    expect(drawerScreen.getByText(webVitalsFlag.flag)).toBeInTheDocument();
    expect(drawerScreen.queryByText(enableReplay.flag)).not.toBeInTheDocument();
  });

  it('allows sort dropdown to affect displayed flags', async function () {
    const drawerScreen = await renderFlagDrawer();

    const [webVitalsFlag, enableReplay] = MOCK_FLAGS.filter(f => f.result === true);

    // the flags are reversed by default, so webVitalsFlag should be following enableReplay
    expect(
      drawerScreen
        .getByText(enableReplay.flag)
        .compareDocumentPosition(drawerScreen.getByText(webVitalsFlag.flag))
    ).toBe(document.DOCUMENT_POSITION_FOLLOWING);

    const sortControl = drawerScreen.getByRole('button', {
      name: 'Sort Flags',
    });
    await userEvent.click(sortControl);
    await userEvent.click(drawerScreen.getByRole('option', {name: 'Oldest First'}));

    // expect webVitalsFlag to be preceding enableReplay
    expect(
      drawerScreen
        .getByText(enableReplay.flag)
        .compareDocumentPosition(drawerScreen.getByText(webVitalsFlag.flag))
    ).toBe(document.DOCUMENT_POSITION_PRECEDING);

    await userEvent.click(sortControl);
    await userEvent.click(drawerScreen.getByRole('option', {name: 'Alphabetical'}));
    await userEvent.click(sortControl);
    await userEvent.click(drawerScreen.getByRole('option', {name: 'Z-A'}));

    // enableReplay follows webVitalsFlag in Z-A sort
    expect(
      drawerScreen
        .getByText(webVitalsFlag.flag)
        .compareDocumentPosition(drawerScreen.getByText(enableReplay.flag))
    ).toBe(document.DOCUMENT_POSITION_FOLLOWING);
  });

  it('renders a sort dropdown with Evaluation Order as the default', async function () {
    const drawerScreen = await renderFlagDrawer();

    const control = drawerScreen.getByRole('button', {name: 'Sort Flags'});
    expect(control).toBeInTheDocument();
    await userEvent.click(control);
    expect(
      drawerScreen.getByRole('option', {name: 'Evaluation Order'})
    ).toBeInTheDocument();
    expect(drawerScreen.getByRole('option', {name: 'Alphabetical'})).toBeInTheDocument();
  });

  it('renders a sort dropdown which affects the granular sort dropdown', async function () {
    const drawerScreen = await renderFlagDrawer();

    const control = drawerScreen.getByRole('button', {name: 'Sort Flags'});
    expect(control).toBeInTheDocument();
    await userEvent.click(control);
    await userEvent.click(drawerScreen.getByRole('option', {name: 'Alphabetical'}));
    await userEvent.click(control);
    expect(drawerScreen.getByRole('option', {name: 'Alphabetical'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(drawerScreen.getByRole('option', {name: 'A-Z'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  it('renders a sort dropdown which disables the appropriate options', async function () {
    const drawerScreen = await renderFlagDrawer();

    const control = drawerScreen.getByRole('button', {name: 'Sort Flags'});
    expect(control).toBeInTheDocument();
    await userEvent.click(control);
    await userEvent.click(drawerScreen.getByRole('option', {name: 'Alphabetical'}));
    await userEvent.click(control);
    expect(drawerScreen.getByRole('option', {name: 'Alphabetical'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(drawerScreen.getByRole('option', {name: 'Newest First'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    expect(drawerScreen.getByRole('option', {name: 'Oldest First'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );

    await userEvent.click(drawerScreen.getByRole('option', {name: 'Evaluation Order'}));
    await userEvent.click(control);
    expect(drawerScreen.getByRole('option', {name: 'Evaluation Order'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(drawerScreen.getByRole('option', {name: 'Z-A'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    expect(drawerScreen.getByRole('option', {name: 'A-Z'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });
});
