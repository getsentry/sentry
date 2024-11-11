import {TagsFixture} from 'sentry-fixture/tags';

import {
  render,
  screen,
  userEvent,
  waitForDrawerToHide,
} from 'sentry-test/reactTestingLibrary';

import {EventFeatureFlagList} from 'sentry/components/events/featureFlags/eventFeatureFlagList';
import {
  MOCK_DATA_SECTION_PROPS,
  MOCK_FLAGS,
} from 'sentry/components/events/featureFlags/testUtils';

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

describe('EventFeatureFlagList', function () {
  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/1/tags/`,
      body: TagsFixture(),
    });
  });
  it('renders a list of feature flags with a button to view all', async function () {
    render(<EventFeatureFlagList {...MOCK_DATA_SECTION_PROPS} />);

    for (const {flag, result} of MOCK_FLAGS) {
      if (result) {
        expect(screen.getByText(flag)).toBeInTheDocument();
      }
    }

    // When expanded, all should be visible
    const viewAllButton = screen.getByRole('button', {name: 'View All'});
    await userEvent.click(viewAllButton);
    const drawer = screen.getByRole('complementary', {name: 'Feature flags drawer'});
    expect(drawer).toBeInTheDocument();
    for (const {flag, result} of MOCK_FLAGS) {
      if (result) {
        expect(screen.getAllByText(flag)[0]).toBeInTheDocument();
      }
    }
  });

  it('toggles the drawer when view all is clicked', async function () {
    render(<EventFeatureFlagList {...MOCK_DATA_SECTION_PROPS} />);
    const viewAllButton = screen.getByRole('button', {name: 'View All'});
    await userEvent.click(viewAllButton);
    const drawer = screen.getByRole('complementary', {name: 'Feature flags drawer'});
    expect(drawer).toBeInTheDocument();
    await userEvent.click(viewAllButton);
    await waitForDrawerToHide('Feature flags drawer');
    expect(drawer).not.toBeInTheDocument();
  });

  it('opens the drawer and focuses search when the search button is pressed', async function () {
    render(<EventFeatureFlagList {...MOCK_DATA_SECTION_PROPS} />);

    const control = screen.getByRole('button', {name: 'Open Feature Flag Search'});
    expect(control).toBeInTheDocument();
    await userEvent.click(control);
    expect(
      screen.getByRole('complementary', {name: 'Feature flags drawer'})
    ).toBeInTheDocument();
    const drawerControl = screen.getByRole('textbox', {
      name: 'Search Flags',
    });
    expect(drawerControl).toBeInTheDocument();
    expect(drawerControl).toHaveFocus();
  });

  it('renders a sort dropdown with Evaluation Order as the default', async function () {
    render(<EventFeatureFlagList {...MOCK_DATA_SECTION_PROPS} />);

    const control = screen.getByRole('button', {name: 'Sort Flags'});
    expect(control).toBeInTheDocument();
    await userEvent.click(control);
    expect(screen.getByRole('option', {name: 'Evaluation Order'})).toBeInTheDocument();
    expect(screen.getByRole('option', {name: 'Alphabetical'})).toBeInTheDocument();
  });

  it('renders a sort dropdown which affects the granular sort dropdown', async function () {
    render(<EventFeatureFlagList {...MOCK_DATA_SECTION_PROPS} />);

    const control = screen.getByRole('button', {name: 'Sort Flags'});
    expect(control).toBeInTheDocument();
    await userEvent.click(control);
    await userEvent.click(screen.getByRole('option', {name: 'Alphabetical'}));
    await userEvent.click(control);
    expect(screen.getByRole('option', {name: 'Alphabetical'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByRole('option', {name: 'A-Z'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  it('renders a sort dropdown which disables the appropriate options', async function () {
    render(<EventFeatureFlagList {...MOCK_DATA_SECTION_PROPS} />);

    const control = screen.getByRole('button', {name: 'Sort Flags'});
    expect(control).toBeInTheDocument();
    await userEvent.click(control);
    await userEvent.click(screen.getByRole('option', {name: 'Alphabetical'}));
    await userEvent.click(control);
    expect(screen.getByRole('option', {name: 'Alphabetical'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByRole('option', {name: 'Newest First'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    expect(screen.getByRole('option', {name: 'Oldest First'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );

    await userEvent.click(screen.getByRole('option', {name: 'Evaluation Order'}));
    await userEvent.click(control);
    expect(screen.getByRole('option', {name: 'Evaluation Order'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByRole('option', {name: 'Z-A'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    expect(screen.getByRole('option', {name: 'A-Z'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });

  it('allows sort dropdown to affect displayed flags', async function () {
    render(<EventFeatureFlagList {...MOCK_DATA_SECTION_PROPS} />);

    const [webVitalsFlag, enableReplay] = MOCK_FLAGS.filter(f => f.result === true);

    // the flags are reversed by default
    // expect enableReplay to be preceding webVitalsFlag
    expect(
      screen
        .getByText(webVitalsFlag.flag)
        .compareDocumentPosition(screen.getByText(enableReplay.flag))
    ).toBe(document.DOCUMENT_POSITION_PRECEDING);

    const sortControl = screen.getByRole('button', {
      name: 'Sort Flags',
    });
    await userEvent.click(sortControl);
    await userEvent.click(screen.getByRole('option', {name: 'Oldest First'}));

    // expect enableReplay to be following webVitalsFlag
    expect(
      screen
        .getByText(webVitalsFlag.flag)
        .compareDocumentPosition(screen.getByText(enableReplay.flag))
    ).toBe(document.DOCUMENT_POSITION_FOLLOWING);

    await userEvent.click(sortControl);
    await userEvent.click(screen.getByRole('option', {name: 'Alphabetical'}));

    // expect enableReplay to be preceding webVitalsFlag, A-Z sort by default
    expect(
      screen
        .getByText(webVitalsFlag.flag)
        .compareDocumentPosition(screen.getByText(enableReplay.flag))
    ).toBe(document.DOCUMENT_POSITION_PRECEDING);

    await userEvent.click(sortControl);
    await userEvent.click(screen.getByRole('option', {name: 'Z-A'}));

    // expect enableReplay to be following webVitalsFlag
    expect(
      screen
        .getByText(webVitalsFlag.flag)
        .compareDocumentPosition(screen.getByText(enableReplay.flag))
    ).toBe(document.DOCUMENT_POSITION_FOLLOWING);
  });
});
