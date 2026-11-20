import {DiscoverDatasets} from 'sentry/utils/discover/types';

import {buildAskSeerPrompt} from './askSeer';

describe('buildAskSeerPrompt', () => {
  it('uses customer-facing dataset names, never the internal enum value', () => {
    const prompt = buildAskSeerPrompt({
      dataset: DiscoverDatasets.OURLOGS,
      outcome: 'client_discard',
      reason: 'buffer_overflow',
    });

    expect(prompt).toContain('My log data');
    expect(prompt).not.toContain('ourlogs');
  });
});
