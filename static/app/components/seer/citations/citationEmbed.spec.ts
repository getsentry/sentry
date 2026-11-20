import {ALL_SEER_EMBED_SCHEMAS} from 'sentry/components/seer/markdown/embeds/schemas';

import {EXAMPLE_CITATIONS} from './__fixtures__/examples';
import {citationToEmbed, describeCitationLocation} from './citationEmbed';

describe('citationToEmbed', () => {
  it.each(EXAMPLE_CITATIONS.map(c => [c.id, c] as const))(
    '%s maps to data its embed accepts',
    (_id, citation) => {
      const embed = citationToEmbed(citation);
      if (embed === null) {
        expect(['feedback', 'code', 'commit', 'pullRequest', 'external']).toContain(
          citation.kind
        );
        return;
      }
      const result = ALL_SEER_EMBED_SCHEMAS[embed.name].schema.safeParse(embed.data);
      expect(result.error).toBeUndefined();
    }
  );

  it('breaks a tag citation down by its tag', () => {
    const tag = EXAMPLE_CITATIONS.find(c => c.id === 'c_tag01')!;
    expect(citationToEmbed(tag)).toEqual({
      name: 'event',
      data: {
        id: '8f2c1a9d7e6b4f30a1b2c3d4e5f60718',
        issueId: '7716642857',
        view: 'tag',
        tagKeys: ['browser'],
      },
    });
  });

  it('renders aggregate queries as aggregates', () => {
    const query = EXAMPLE_CITATIONS.find(c => c.id === 'c_query01')!;
    expect(citationToEmbed(query)).toMatchObject({
      name: 'errorsQuery',
      data: {
        mode: 'aggregate',
        yAxes: ['count()', 'count_unique(user)'],
        statsPeriod: '24h',
      },
    });
  });
});

describe('describeCitationLocation', () => {
  it('describes the cited part of the datum', () => {
    const byId = Object.fromEntries(EXAMPLE_CITATIONS.map(c => [c.id, c]));
    expect(describeCitationLocation(byId.c_frame01!)).toBe(
      'submitOrder (app/checkout.ts:88)'
    );
    expect(describeCitationLocation(byId.c_issue01!)).toBe('users: 903');
    expect(describeCitationLocation(byId.c_replay01!)).toBe('at 0:42');
    expect(describeCitationLocation(byId.c_code01!)).toBe('app/checkout.ts:80-95');
  });
});
