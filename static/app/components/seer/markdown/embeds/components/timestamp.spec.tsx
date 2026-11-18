import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DateTimeProvider} from '@sentry/scraps/dateTime';

import {renderEmbedMarkdown} from './resourceEmbedTestUtils';
import {Timestamp} from './timestamp';

describe('timestamp embed', () => {
  const value = '2025-07-15T14:30:00Z';

  it.each(['absolute', 'relative'] as const)(
    'serializes a %s timestamp to the same text the element shows',
    format => {
      const {container} = render(
        <Timestamp name="timestamp" data={{value, format}} level="inline" />
      );
      const rendered = container.textContent;

      expect(renderEmbedMarkdown(Timestamp, 'timestamp', {value, format})).toBe(rendered);
    }
  );

  it('defaults to the absolute format, as the schema does', () => {
    const {container} = render(
      <Timestamp name="timestamp" data={{value}} level="inline" />
    );

    expect(renderEmbedMarkdown(Timestamp, 'timestamp', {value})).toBe(
      container.textContent
    );
  });

  it('reads a datetime without an offset as UTC', () => {
    render(
      <DateTimeProvider value={{timezone: 'America/Los_Angeles'}}>
        <Timestamp
          name="timestamp"
          data={{value: '2025-07-15T14:30:00'}}
          level="inline"
        />
      </DateTimeProvider>
    );

    expect(screen.getByText('Jul 15, 2025 7:30 AM')).toBeInTheDocument();
  });

  it('shows a calendar date without shifting it into the viewer timezone', () => {
    render(
      <DateTimeProvider value={{timezone: 'America/Los_Angeles'}}>
        <Timestamp name="timestamp" data={{value: '2025-07-15'}} level="inline" />
      </DateTimeProvider>
    );

    expect(screen.getByText('Jul 15, 2025')).toBeInTheDocument();
  });
});
