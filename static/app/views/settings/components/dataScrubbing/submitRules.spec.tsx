import type {Client} from 'sentry/api';
import {submitRules} from 'sentry/views/settings/components/dataScrubbing/submitRules';
import {MethodType, RuleType} from 'sentry/views/settings/components/dataScrubbing/types';

describe('submitRules', () => {
  it('handles rule sources that match Object prototype properties', async () => {
    const requestPromise = jest.fn().mockResolvedValue({});
    const api = {requestPromise} as unknown as Client;

    await submitRules(api, '/scrubbing/', [
      {
        id: 1,
        method: MethodType.MASK,
        source: 'constructor',
        type: RuleType.EMAIL,
      },
    ]);

    const requestOptions = requestPromise.mock.calls[0]?.[1];
    const relayPiiConfig = JSON.parse(requestOptions.data.relayPiiConfig);

    expect(relayPiiConfig.applications.constructor).toEqual(['0']);
  });
});
