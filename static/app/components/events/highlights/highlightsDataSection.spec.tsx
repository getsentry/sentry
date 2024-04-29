import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import HighlightsDataSection from 'sentry/components/events/highlights/highlightsDataSection';

HighlightsDataSection;

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
  const highlightTags = ['environment', 'handled', 'transaction', 'url'];
  const highlightContext = {
    user: ['email'],
    browser: ['name', 'version'],
  };
  const highlightContextTitles = ['User: email', 'Browser: name', 'Browser: version'];
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
    expect(screen.getByRole('button', {name: 'Edit'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Add Highlights'})).toBeInTheDocument();
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
    const tagRows = screen.queryAllByTestId('highlight-tag-row');
    expect(tagRows.length).toBe(highlightTags.length);
    const ctxRows = screen.queryAllByTestId('highlight-context-row');
    expect(ctxRows.length).toBe(Object.values(highlightContext).flat().length);
    highlightContextTitles.forEach(title => {
      expect(screen.getByText(title)).toBeInTheDocument();
    });
  });
});
