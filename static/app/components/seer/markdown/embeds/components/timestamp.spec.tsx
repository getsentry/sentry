import {render} from 'sentry-test/reactTestingLibrary';

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
});
