import {Entries123Base, Entries123Target} from 'sentry-fixture/entries';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {IssueDiff} from 'sentry/components/issueDiff';
import {trackAnalytics} from 'sentry/utils/analytics';

jest.mock('sentry/api');
jest.mock('sentry/utils/analytics');

describe('IssueDiff', () => {
  const entries123Target = Entries123Target();
  const entries123Base = Entries123Base();

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/issues/base/events/latest/',
      body: {
        eventID: '123base',
      },
    });
    MockApiClient.addMockResponse({
      url: '/issues/target/events/latest/',
      body: {
        eventID: '123target',
      },
    });
    MockApiClient.addMockResponse({
      url: '/issues/target/events/123target/',
      body: {
        entries: entries123Target,
      },
    });

    MockApiClient.addMockResponse({
      url: '/issues/base/events/123base/',
      body: {
        platform: 'javascript',
        entries: entries123Base,
      },
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('is loading when initially rendering', async () => {
    render(<IssueDiff baseIssueId="base" targetIssueId="target" />);
    expect(screen.queryByTestId('split-diff')).not.toBeInTheDocument();
    expect(await screen.findByTestId('split-diff')).toBeInTheDocument();
  });

  it('can dynamically import SplitDiff', async () => {
    render(
      <IssueDiff
        baseIssueId="base"
        targetIssueId="target"
        shouldBeGrouped="Yes"
        hasSimilarityEmbeddingsProjectFeature
      />
    );

    expect(await screen.findByTestId('split-diff')).toBeInTheDocument();
    expect(trackAnalytics).toHaveBeenCalled();
  });

  it('can diff message', async () => {
    MockApiClient.addMockResponse({
      url: '/issues/target/events/123target/',
      body: {
        entries: [{type: 'message', data: {formatted: 'Hello World'}}],
      },
    });
    MockApiClient.addMockResponse({
      url: '/issues/base/events/123base/',
      body: {
        platform: 'javascript',
        entries: [{type: 'message', data: {formatted: 'Foo World'}}],
      },
    });

    render(<IssueDiff baseIssueId="base" targetIssueId="target" />);

    expect(await screen.findByTestId('split-diff')).toBeInTheDocument();
  });
});
