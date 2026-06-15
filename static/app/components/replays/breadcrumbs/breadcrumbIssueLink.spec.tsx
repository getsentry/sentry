import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {BreadcrumbIssueLink} from 'sentry/components/replays/breadcrumbs/breadcrumbIssueLink';
import type {ErrorFrame, FeedbackFrame} from 'sentry/utils/replays/types';

describe('BreadcrumbIssueLink', () => {
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [ProjectFixture({slug: 'my-project'})],
    });
  });

  it('links to the issue for error frames', async () => {
    const frame = {
      category: 'issue',
      data: {
        eventId: 'abc123',
        groupId: 1,
        groupShortId: 'PROJ-1',
        label: 'TypeError',
        labels: ['TypeError'],
        level: 'error',
        projectSlug: 'my-project',
      },
      message: 'Something broke',
      offsetMs: 0,
      timestamp: new Date(),
      timestampMs: Date.now(),
      type: 'error',
    } as ErrorFrame;

    render(<BreadcrumbIssueLink frame={frame} />);

    const link = await screen.findByRole('link', {name: 'PROJ-1'});
    expect(link).toHaveAttribute('href', '/organizations/org-slug/issues/1/');
  });

  it('links to feedback for feedback frames', async () => {
    const frame = {
      category: 'feedback',
      data: {
        eventId: 'def456',
        groupId: 2,
        groupShortId: 'PROJ-2',
        label: 'User Feedback',
        labels: ['User Feedback'],
        projectSlug: 'my-project',
      },
      message: 'This is broken',
      offsetMs: 0,
      timestamp: new Date(),
      timestampMs: Date.now(),
      type: 'user',
    } as FeedbackFrame;

    render(<BreadcrumbIssueLink frame={frame} />);

    const link = await screen.findByRole('link', {name: 'PROJ-2'});
    expect(link).toHaveAttribute('href', expect.stringContaining('/issues/feedback/'));
  });

  it('renders nothing when frame.data is undefined', () => {
    const frame = {
      category: 'feedback',
      data: undefined,
      message: 'User Feedback',
      offsetMs: 0,
      timestamp: new Date(),
      timestampMs: Date.now(),
      type: 'user',
    } as unknown as FeedbackFrame;

    const {container} = render(<BreadcrumbIssueLink frame={frame} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for non-error/feedback frames', () => {
    const frame = {
      category: 'ui.click',
      data: {},
      message: 'click',
      offsetMs: 0,
      timestamp: new Date(),
      timestampMs: Date.now(),
      type: 'default',
    } as any;

    const {container} = render(<BreadcrumbIssueLink frame={frame} />);
    expect(container).toBeEmptyDOMElement();
  });
});
