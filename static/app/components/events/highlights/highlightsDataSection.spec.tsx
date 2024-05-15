import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import * as modal from 'sentry/actionCreators/modal';
import HighlightsDataSection from 'sentry/components/events/highlights/highlightsDataSection';
import * as analytics from 'sentry/utils/analytics';

HighlightsDataSection;

import {EMPTY_HIGHLIGHT_DEFAULT} from 'sentry/components/events/highlights/util';
import {
  TEST_EVENT_CONTEXTS,
  TEST_EVENT_TAGS,
} from 'sentry/components/events/highlights/util.spec';

describe('HighlightsDataSection', function () {
  const organization = OrganizationFixture({features: ['event-tags-tree-ui']});
  const project = ProjectFixture();
  const event = EventFixture({
    contexts: TEST_EVENT_CONTEXTS,
    tags: TEST_EVENT_TAGS,
  });
  const group = GroupFixture();
  const eventTagMap = TEST_EVENT_TAGS.reduce(
    (tagMap, tag) => ({...tagMap, [tag.key]: tag.value}),
    {}
  );
  const highlightTags = ['environment', 'handled', 'transaction', 'url'];
  const highlightContext = {
    user: ['email'],
    browser: ['name', 'version'],
  };
  const highlightContextTitles = ['User: email', 'Browser: name', 'Browser: version'];
  const analyticsSpy = jest.spyOn(analytics, 'trackAnalytics');
  const modalSpy = jest.spyOn(modal, 'openModal');

  it('renders an empty state', async function () {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      body: {...project, highlightTags: [], highlightContext: {}},
    });
    render(
      <HighlightsDataSection
        event={event}
        group={group}
        project={project}
        viewAllRef={{current: null}}
      />,
      {organization}
    );
    expect(screen.getByText('Event Highlights')).toBeInTheDocument();
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    expect(await screen.findByText("There's nothing here...")).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Add Highlights'})).toBeInTheDocument();
    const viewAllButton = screen.getByRole('button', {name: 'View All'});
    await viewAllButton.click();
    expect(analyticsSpy).toHaveBeenCalledWith(
      'highlights.issue_details.view_all_clicked',
      expect.anything()
    );
    const editButton = screen.getByRole('button', {name: 'Edit'});
    await editButton.click();
    expect(analyticsSpy).toHaveBeenCalledWith(
      'highlights.issue_details.edit_clicked',
      expect.anything()
    );
    expect(modalSpy).toHaveBeenCalled();
  });

  it('renders highlights from the detailed project API response', async function () {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      body: {...project, highlightTags, highlightContext},
    });

    render(<HighlightsDataSection event={event} group={group} project={project} />, {
      organization,
    });
    expect(screen.getByText('Event Highlights')).toBeInTheDocument();
    expect(await screen.findByTestId('loading-indicator')).not.toBeInTheDocument();
    for (const tagKey of highlightTags) {
      const row = screen
        .getByText(tagKey, {selector: 'div'})
        .closest('div[data-test-id=highlight-tag-row]') as HTMLElement;
      // If highlight is present on the event...
      if (eventTagMap.hasOwnProperty(tagKey)) {
        expect(within(row).getByText(eventTagMap[tagKey])).toBeInTheDocument();
        expect(within(row).getByLabelText('Tag Actions Menu')).toBeInTheDocument();
      } else {
        expect(within(row).getByText(EMPTY_HIGHLIGHT_DEFAULT)).toBeInTheDocument();
        expect(within(row).queryByLabelText('Tag Actions Menu')).not.toBeInTheDocument();
      }
    }

    const ctxRows = screen.queryAllByTestId('highlight-context-row');
    expect(ctxRows.length).toBe(Object.values(highlightContext).flat().length);
    highlightContextTitles.forEach(title => {
      expect(screen.getByText(title)).toBeInTheDocument();
    });
  });
});
