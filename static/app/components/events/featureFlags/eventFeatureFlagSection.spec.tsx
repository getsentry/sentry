import {OrganizationFixture} from 'sentry-fixture/organization';
import {TagsFixture} from 'sentry-fixture/tags';

import {
  render,
  screen,
  userEvent,
  waitForDrawerToHide,
} from 'sentry-test/reactTestingLibrary';

import {EventFeatureFlagSection} from 'sentry/components/events/featureFlags/eventFeatureFlagSection';
import {
  EMPTY_STATE_SECTION_PROPS,
  MOCK_DATA_SECTION_PROPS,
  MOCK_DATA_SECTION_PROPS_MANY_FLAGS,
  MOCK_DATA_SECTION_PROPS_ONE_EXTRA_FLAG,
  MOCK_FLAGS,
  NO_FLAG_CONTEXT_SECTION_PROPS,
  NO_FLAG_CONTEXT_WITH_FLAGS_SECTION_PROPS,
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

describe('EventFeatureFlagList', () => {
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
      url: '/organizations/org-slug/prompts-activity/',
      body: {data: {}},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/prompts-activity/',
      body: {data: {dismissed_ts: null}},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/1/tags/`,
      body: TagsFixture(),
    });
  });

  it('renders a list of feature flags with a button to view more flags', async () => {
    render(<EventFeatureFlagSection {...MOCK_DATA_SECTION_PROPS_ONE_EXTRA_FLAG} />);

    for (const {flag, result} of MOCK_FLAGS) {
      if (result) {
        expect(screen.getAllByText(flag)[0]).toBeInTheDocument();
      }
    }

    // When expanded, all should be visible
    const viewAllButton = screen.getByRole('button', {name: 'View 1 More Flag'});
    await userEvent.click(viewAllButton);
    const drawer = screen.getByRole('complementary', {name: 'Feature flags drawer'});
    expect(drawer).toBeInTheDocument();
    for (const {flag, result} of MOCK_FLAGS) {
      if (result) {
        expect(screen.getAllByText(flag)[0]).toBeInTheDocument();
      }
    }
  });

  it('toggles the drawer when `view n flags` is clicked', async () => {
    render(<EventFeatureFlagSection {...MOCK_DATA_SECTION_PROPS_MANY_FLAGS} />);
    const viewAllButton = screen.getByRole('button', {name: 'View 3 More Flags'});
    await userEvent.click(viewAllButton);
    const drawer = screen.getByRole('complementary', {name: 'Feature flags drawer'});
    expect(drawer).toBeInTheDocument();
    await userEvent.click(viewAllButton);
    await waitForDrawerToHide('Feature flags drawer');
    expect(drawer).not.toBeInTheDocument();
  });

  it('opens the drawer and focuses search when the search button is pressed', async () => {
    render(<EventFeatureFlagSection {...MOCK_DATA_SECTION_PROPS} />);

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

  it('renders a sort dropdown with Evaluation Order as the default', async () => {
    render(<EventFeatureFlagSection {...MOCK_DATA_SECTION_PROPS} />);

    const control = screen.getByRole('button', {name: 'Sort Flags'});
    expect(control).toBeInTheDocument();
    await userEvent.click(control);
    expect(screen.getByRole('option', {name: 'Evaluation Order'})).toBeInTheDocument();
    expect(screen.getByRole('option', {name: 'Alphabetical'})).toBeInTheDocument();
  });

  it('renders a sort dropdown which affects the granular sort dropdown', async () => {
    render(<EventFeatureFlagSection {...MOCK_DATA_SECTION_PROPS} />);

    const control = screen.getByRole('button', {name: 'Sort Flags'});
    expect(control).toBeInTheDocument();
    await userEvent.click(control);
    await userEvent.click(screen.getByRole('option', {name: 'Alphabetical'}));
    expect(screen.getByRole('option', {name: 'Alphabetical'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByRole('option', {name: 'A-Z'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  it('renders a sort dropdown which hides the invalid options', async () => {
    render(<EventFeatureFlagSection {...MOCK_DATA_SECTION_PROPS} />);

    const control = screen.getByRole('button', {name: 'Sort Flags'});
    expect(control).toBeInTheDocument();
    await userEvent.click(control);
    await userEvent.click(screen.getByRole('option', {name: 'Alphabetical'}));
    expect(screen.getByRole('option', {name: 'Alphabetical'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.queryByRole('option', {name: 'Newest First'})).not.toBeInTheDocument();
    expect(screen.queryByRole('option', {name: 'Oldest First'})).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('option', {name: 'Evaluation Order'}));
    expect(screen.getByRole('option', {name: 'Evaluation Order'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.queryByRole('option', {name: 'Z-A'})).not.toBeInTheDocument();
    expect(screen.queryByRole('option', {name: 'A-Z'})).not.toBeInTheDocument();
  });

  it('allows sort dropdown to affect displayed flags', async () => {
    render(<EventFeatureFlagSection {...MOCK_DATA_SECTION_PROPS} />);

    const [webVitalsFlag, enableReplay] = MOCK_FLAGS.filter(f => f.result === true);

    // the flags are reversed by default
    // expect enableReplay to be preceding webVitalsFlag
    expect(
      screen
        .getByText(webVitalsFlag!.flag)
        .compareDocumentPosition(screen.getByText(enableReplay!.flag))
    ).toBe(document.DOCUMENT_POSITION_PRECEDING);

    const sortControl = screen.getByRole('button', {
      name: 'Sort Flags',
    });
    await userEvent.click(sortControl);
    await userEvent.click(screen.getByRole('option', {name: 'Oldest First'}));
    await userEvent.click(sortControl); // close dropdown

    // expect enableReplay to be following webVitalsFlag
    expect(
      screen
        .getByText(webVitalsFlag!.flag)
        .compareDocumentPosition(screen.getByText(enableReplay!.flag))
    ).toBe(document.DOCUMENT_POSITION_FOLLOWING);

    await userEvent.click(sortControl);
    await userEvent.click(screen.getByRole('option', {name: 'Alphabetical'}));
    await userEvent.click(sortControl); // close dropdown

    // expect enableReplay to be preceding webVitalsFlag, A-Z sort by default
    expect(
      screen
        .getByText(webVitalsFlag!.flag)
        .compareDocumentPosition(screen.getByText(enableReplay!.flag))
    ).toBe(document.DOCUMENT_POSITION_PRECEDING);

    await userEvent.click(sortControl);
    await userEvent.click(screen.getByRole('option', {name: 'Z-A'}));
    await userEvent.click(sortControl); // close dropdown

    // expect enableReplay to be following webVitalsFlag
    expect(
      screen
        .getByText(webVitalsFlag!.flag)
        .compareDocumentPosition(screen.getByText(enableReplay!.flag))
    ).toBe(document.DOCUMENT_POSITION_FOLLOWING);
  });

  it('renders empty state if project has flags', () => {
    render(<EventFeatureFlagSection {...EMPTY_STATE_SECTION_PROPS} />);

    const control = screen.queryByRole('button', {name: 'Sort Flags'});
    expect(control).not.toBeInTheDocument();
    const search = screen.queryByRole('button', {name: 'Open Feature Flag Search'});
    expect(search).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Feature Flag Settings'})
    ).toBeInTheDocument();
    expect(
      screen.getByText('No feature flags were found for this event')
    ).toBeInTheDocument();
  });

  it('renders empty state if event.contexts.flags is not set - flags already sent', () => {
    const org = OrganizationFixture({features: []});

    render(<EventFeatureFlagSection {...NO_FLAG_CONTEXT_WITH_FLAGS_SECTION_PROPS} />, {
      organization: org,
    });

    const control = screen.queryByRole('button', {name: 'Sort Flags'});
    expect(control).not.toBeInTheDocument();
    const search = screen.queryByRole('button', {name: 'Open Feature Flag Search'});
    expect(search).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Feature Flag Settings'})
    ).toBeInTheDocument();
    expect(
      screen.getByText('No feature flags were found for this event')
    ).toBeInTheDocument();
  });

  it('renders nothing if event.contexts.flags is not set - wrong platform', () => {
    const org = OrganizationFixture({features: []});

    render(<EventFeatureFlagSection {...NO_FLAG_CONTEXT_SECTION_PROPS} />, {
      organization: org,
    });

    const control = screen.queryByRole('button', {name: 'Sort Flags'});
    expect(control).not.toBeInTheDocument();
    const search = screen.queryByRole('button', {name: 'Open Feature Flag Search'});
    expect(search).not.toBeInTheDocument();
    expect(screen.queryByText('Feature Flags')).not.toBeInTheDocument();
  });
});
