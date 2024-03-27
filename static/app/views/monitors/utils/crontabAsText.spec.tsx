import {shouldUse24Hours} from 'sentry/utils/dates';

import {crontabAsText} from './crontabAsText';

jest.mock('sentry/utils/dates');

describe('crontabAsText', function () {
  beforeEach(() => {
    jest.mocked(shouldUse24Hours).mockReturnValue(false);
  });

  it('translates simple crontab', function () {
    expect(crontabAsText('* * * * *')).toBe('Every minute');
    expect(crontabAsText('10 * * * *')).toBe('At 10 minutes past the hour');
  });

  it('handles 24 hour clock', function () {
    expect(crontabAsText('0 5/* * 1-5 *')).toBe(
      'At 0 minutes past the hour, every * hours, starting at 05:00 AM, January through May'
    );

    jest.mocked(shouldUse24Hours).mockReturnValue(true);

    expect(crontabAsText('0 5/* * 1-5 *')).toBe(
      'At 0 minutes past the hour, every * hours, starting at 05:00, January through May'
    );
  });
});
