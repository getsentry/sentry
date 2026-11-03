import {getInvestigationOutline} from 'sentry/views/investigations/detail/outline';
import {
  InvestigationBlockExecutionFixture,
  InvestigationBlockFixture,
} from 'sentry/views/investigations/fixtures';
import type {InvestigationBlock} from 'sentry/views/investigations/types';

function textBlock(id: string, markdown: string, title = '') {
  return InvestigationBlockFixture({
    id,
    title,
    content: '',
    outputStatus: 'completed',
    output: {schemaVersion: 1, markdown},
  });
}

function outlineOf(blocks: InvestigationBlock[]) {
  return getInvestigationOutline({
    blocks,
    hasActivity: false,
    hasHypotheses: false,
    hasSummary: false,
  });
}

describe('getInvestigationOutline', () => {
  it('lists the headings the blocks render rather than their titles', () => {
    const outline = getInvestigationOutline({
      blocks: [
        textBlock('what', '## What happened\n\nCheckout slowed down.', 'What happened'),
        InvestigationBlockFixture({id: 'chart', kind: 'query', title: 'Error volume'}),
        textBlock(
          'when',
          '## When it happened\n\nRight after the deploy.',
          'Deploy timing'
        ),
      ],
      hasActivity: true,
      hasHypotheses: true,
      hasSummary: true,
    });

    expect(outline.map(entry => entry.label)).toEqual([
      'Summary',
      'Hypotheses',
      'What happened',
      'When it happened',
      'Activity',
    ]);
    expect(outline[3]).toEqual({
      depth: 2,
      key: 'when:0',
      label: 'When it happened',
      nested: false,
      target: {blockId: 'when', headingIndex: 0},
    });
  });

  it('is empty until the blocks have two headings between them', () => {
    expect(
      getInvestigationOutline({
        blocks: [
          textBlock('what', '## What happened\n\nCheckout slowed down.'),
          textBlock('notes', 'Some notes without a heading.'),
        ],
        hasActivity: true,
        hasHypotheses: true,
        hasSummary: true,
      })
    ).toEqual([]);
  });

  it('reads headings from content a person wrote', () => {
    const outline = outlineOf([
      InvestigationBlockFixture({id: 'notes', content: '# Notes\n\n## Open questions'}),
    ]);

    expect(outline.map(entry => [entry.label, entry.depth, entry.nested])).toEqual([
      ['Notes', 1, false],
      ['Open questions', 2, true],
    ]);
  });

  it('keeps two levels of heading, counting the ones it leaves out', () => {
    const outline = outlineOf([
      textBlock(
        'notes',
        '## Findings\n\n#### Raw numbers\n\n### Latency\n\n## Next steps'
      ),
    ]);

    expect(
      outline.map(entry => [
        entry.label,
        entry.depth,
        entry.nested,
        'headingIndex' in entry.target ? entry.target.headingIndex : null,
      ])
    ).toEqual([
      ['Findings', 2, false, 0],
      ['Latency', 3, true, 2],
      ['Next steps', 2, false, 3],
    ]);
  });

  it('finds headings inside block quotes and lists, as plain text', () => {
    const outline = outlineOf([
      textBlock(
        'notes',
        '> ## What `payments-api` changed\n\n- ## [Who is affected](https://example.com)'
      ),
    ]);

    expect(outline.map(entry => entry.label)).toEqual([
      'What payments-api changed',
      'Who is affected',
    ]);
  });

  it("stands in a running block's title for the heading it hasn't written yet", () => {
    const outline = outlineOf([
      textBlock('what', '## What happened\n\nCheckout slowed down.'),
      InvestigationBlockFixture({
        id: 'next',
        title: 'What to do next',
        content: '',
        outputStatus: 'running',
        currentExecution: InvestigationBlockExecutionFixture({status: 'running'}),
      }),
      InvestigationBlockFixture({id: 'untouched', title: 'Not started', content: ''}),
    ]);

    expect(outline.map(entry => entry.label)).toEqual([
      'What happened',
      'What to do next',
    ]);
    expect(outline[1]).toMatchObject({
      depth: 2,
      target: {blockId: 'next', headingIndex: null},
    });
  });
});
