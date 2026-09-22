import {Dsn} from './dsn';
import {renderEmbedMarkdown} from './resourceEmbedTestUtils';

describe('dsn embed', () => {
  it('serializes to the DSN as code, which is what the copy input carried', () => {
    expect(
      renderEmbedMarkdown(Dsn, 'dsn', {
        value: 'https://examplePublicKey@o0.ingest.sentry.io/0',
      })
    ).toBe('`https://examplePublicKey@o0.ingest.sentry.io/0`');
  });
});
