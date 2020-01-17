import {trackQuery} from 'app/views/discover/analytics';
import {analytics} from 'app/utils/analytics';

jest.mock('app/utils/analytics');

describe('Analytics', function() {
  beforeEach(function() {
    const query = {
      fields: ['col1'],
      projects: [1],
      conditions: [
        ['customer', '=', 'test@test.com'],
        ['some_count', '=', 5],
      ],
    };

    trackQuery(TestStubs.Organization(), query);
  });

  it('scrubs only conditions with strings', function() {
    const conditions = [
      ['customer', '=', '[REDACTED]'],
      ['some_count', '=', 5],
    ];

    expect(analytics).toHaveBeenCalledWith(
      'discover.query',
      expect.objectContaining({
        conditions,
      })
    );
  });
});
