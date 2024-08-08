import {EventFixture} from 'sentry-fixture/event';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {HighlightsIconSummary} from 'sentry/components/events/highlights/highlightsIconSummary';
import {
  TEST_EVENT_CONTEXTS,
  TEST_EVENT_TAGS,
} from 'sentry/components/events/highlights/util.spec';

jest.mock('sentry/components/events/contexts/contextIcon', () => ({
  ...jest.requireActual('sentry/components/events/contexts/contextIcon'),
  getLogoImage: () => 'data:image/test',
}));

describe('HighlightsIconSummary', function () {
  const event = EventFixture({
    contexts: TEST_EVENT_CONTEXTS,
    tags: TEST_EVENT_TAGS,
  });

  it('renders appropriate icons and text', function () {
    render(<HighlightsIconSummary event={event} />);
    expect(screen.getByText('Mac OS X')).toBeInTheDocument();
    expect(screen.getByText('Version: 10.15')).toBeInTheDocument();
    expect(screen.getByText('CPython')).toBeInTheDocument();
    expect(screen.getByText('Version: 3.8.13')).toBeInTheDocument();
    expect(screen.getAllByRole('img')).toHaveLength(2);
  });
});
