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

  it('renders a flag granular sort dropdown with Newest as the default', async function () {
    render(<EventFeatureFlagList {...MOCK_DATA_SECTION_PROPS} />);

    const control = screen.getByRole('button', {name: 'Newest'});
    expect(control).toBeInTheDocument();
    await userEvent.click(control);
    expect(screen.getByRole('option', {name: 'Oldest'})).toBeInTheDocument();
  });

  it('renders a sort group dropdown with Evaluation Order as the default', async function () {
    render(<EventFeatureFlagList {...MOCK_DATA_SECTION_PROPS} />);

    const control = screen.getByRole('button', {name: 'Evaluation Order'});
    expect(control).toBeInTheDocument();
    await userEvent.click(control);
    expect(screen.getByRole('option', {name: 'Evaluation Order'})).toBeInTheDocument();
    expect(screen.getByRole('option', {name: 'Alphabetical'})).toBeInTheDocument();
  });

  it('renders a sort group dropdown which affects the granular sort dropdown', async function () {
    render(<EventFeatureFlagList {...MOCK_DATA_SECTION_PROPS} />);

    const control = screen.getByRole('button', {name: 'Evaluation Order'});
    expect(control).toBeInTheDocument();
    await userEvent.click(control);
    await userEvent.click(screen.getByRole('option', {name: 'Alphabetical'}));
    expect(screen.getByRole('button', {name: 'A-Z'})).toBeInTheDocument();
  });

  it('allows sort dropdown to affect displayed flags', async function () {
    render(<EventFeatureFlagList {...MOCK_DATA_SECTION_PROPS} />);

    const [webVitalsFlag, enableReplay] = MOCK_FLAGS.filter(f => f.result === true);

    // the flags are reversed by default, so webVitalsFlag should be below enableReplay
    expect(
      screen
        .getByText(webVitalsFlag.flag)
        .compareDocumentPosition(screen.getByText(enableReplay.flag))
    ).toBe(document.DOCUMENT_POSITION_FOLLOWING);

    // the sort should be reversed
    const sortControl = screen.getByRole('button', {
      name: 'Newest',
    });
    await userEvent.click(sortControl);
    await userEvent.click(screen.getByRole('option', {name: 'Oldest'}));

    expect(
      screen
        .getByText(webVitalsFlag.flag)
        .compareDocumentPosition(screen.getByText(enableReplay.flag))
    ).toBe(document.DOCUMENT_POSITION_PRECEDING);

    const sortGroupControl = screen.getByRole('button', {
      name: 'Evaluation Order',
    });
    await userEvent.click(sortGroupControl);
    await userEvent.click(screen.getByRole('option', {name: 'Alphabetical'}));
    await userEvent.click(sortControl);
    await userEvent.click(screen.getByRole('option', {name: 'Z-A'}));

    // webVitalsFlag comes after enableReplay alphabetically
    expect(
      screen
        .getByText(webVitalsFlag.flag)
        .compareDocumentPosition(screen.getByText(enableReplay.flag))
    ).toBe(document.DOCUMENT_POSITION_PRECEDING);
  });
});
