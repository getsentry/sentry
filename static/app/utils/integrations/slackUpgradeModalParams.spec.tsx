import {getSlackUpgradeModalParams} from './slackUpgradeModalParams';

const instructions =
  'Reauthorize the Sentry app in your Slack workspace and accept the updated permissions to continue.';

describe('getSlackUpgradeModalParams', () => {
  it('joins multiple feature descriptions as sentences in a plain string', () => {
    expect(
      getSlackUpgradeModalParams([
        {
          key: 'seer_mentions',
          description:
            'Mention @Sentry in Slack to ask questions and investigate issues with Seer.',
        },
        {key: 'example', description: 'Use another server-provided feature.'},
      ])
    ).toEqual({
      title: 'Update Slack App Permissions',
      description:
        'Updating Slack app permissions enables these features. Mention @Sentry in Slack to ask questions and investigate issues with Seer. Use another server-provided feature. ' +
        instructions,
    });
  });

  it.each([null, undefined, []])('keeps the neutral fallback for %p', features => {
    expect(getSlackUpgradeModalParams(features).description).toBe(instructions);
  });
});
