import {initializeData} from 'sentry-test/performance/initializePerformanceData';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {EventEntries} from 'sentry/components/events/eventEntries';
import {Group, IssueCategory} from 'sentry/types';
import {EntryType} from 'sentry/types/event';

const {organization, project, router} = initializeData();

describe('EventEntries', function () {
  const event = TestStubs.Event();

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/events/${event.id}/grouping-info/`,
      body: {},
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/projects/${organization.slug}/${project.slug}/events/${event.id}/committers/`,
      body: {
        committers: [],
      },
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  describe('Rendering', function () {
    it('renders the Resources section for Performance Issues', function () {
      const group: Group = TestStubs.Group({issueCategory: IssueCategory.PERFORMANCE});

      const newEvent = {
        ...event,
        entries: [{type: EntryType.SPANS, data: []}],
      };

      render(
        <EventEntries
          organization={organization}
          event={newEvent}
          project={project}
          location={router.location}
          group={group}
        />,
        {organization}
      );

      const resourcesHeadingText = screen.getByRole('heading', {
        name: /resources and whatever/i,
      });

      expect(resourcesHeadingText).toBeInTheDocument();
    });

    it('injects the resources section in the correct spot', function () {
      const group: Group = TestStubs.Group({issueCategory: IssueCategory.PERFORMANCE});
      group.issueCategory = IssueCategory.PERFORMANCE;
      const sampleBreadcrumb = {
        type: 'default',
        timestamp: '2022-09-19T19:29:32.261000Z',
        level: 'info',
        message: 'span.css-1hs7lfd.e1b8u3ky1 > svg',
        category: 'ui.click',
        data: null,
        event_id: null,
      };

      const newEvent = {
        ...event,
        title: 'test',
        perfProblem: {parentSpanIds: ['a'], causeSpanIds: ['a'], offenderSpanIds: ['a']},
        entries: [
          {type: EntryType.SPANS, data: [{span_id: 'a'}]},
          {type: EntryType.BREADCRUMBS, data: {values: [sampleBreadcrumb]}},
          {type: EntryType.REQUEST, data: {}},
        ],
      };

      render(
        <EventEntries
          organization={organization}
          event={newEvent}
          project={project}
          location={router.location}
          group={group}
        />
      );

      const spanEvidenceHeading = screen.getByRole('heading', {
        name: /span evidence/i,
      });
      const breadcrumbsHeading = screen.getByRole('heading', {
        name: /breadcrumbs/i,
      });
      const resourcesHeadingText = screen.getByRole('heading', {
        name: /resources and whatever/i,
      });

      expect(spanEvidenceHeading).toBeInTheDocument();
      expect(breadcrumbsHeading).toBeInTheDocument();
      expect(resourcesHeadingText).toBeInTheDocument();

      expect(
        screen.getByRole('heading', {
          name: /span evidence/i,
        })
      ).toBeInTheDocument();

      expect(
        screen.getByRole('heading', {
          name: /breadcrumbs/i,
        })
      ).toBeInTheDocument();

      expect(
        screen.getByRole('heading', {
          name: /resources and whatever/i,
        })
      ).toBeInTheDocument();
    });
  });
});
