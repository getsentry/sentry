import assert from 'node:assert/strict';
import fs from 'node:fs';
import {test} from 'node:test';

import {renderToStaticMarkup} from 'react-dom/server';
import {createProcessor, evaluateSync} from '@mdx-js/mdx';
import * as runtime from 'react/jsx-runtime';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';

import {indexStoryHeadings, remarkStoryHeadings} from './story-headings.ts';

const parser = createProcessor({remarkPlugins: [remarkFrontmatter, remarkGfm]});

function index(source: string) {
  return indexStoryHeadings(parser.parse(source));
}

test('keeps unique fragments and scopes repeated titles to their parent', () => {
  assert.deepEqual(
    index('## First section\n### Details\n## Second section\n### Details'),
    [
      {id: 'first-section', title: 'First section', parents: []},
      {id: 'first-section-details', title: 'Details', parents: ['First section']},
      {id: 'second-section', title: 'Second section', parents: []},
      {id: 'second-section-details', title: 'Details', parents: ['Second section']},
    ]
  );
});

test('numbers repeated siblings without stealing unique or scoped IDs', () => {
  assert.deepEqual(
    index('## Details\n## Details\n## Details-2').map(h => h.id),
    ['details', 'details-3', 'details-2']
  );
  assert.deepEqual(
    index('## A\n### Details\n### Details\n## A-details').map(h => h.id),
    ['a', 'a-details-2', 'a-details-3', 'a-details']
  );
  assert.deepEqual(
    index('## A\n### Details\n#### More\n## B\n### Details\n#### More').map(h => h.id),
    ['a', 'a-details', 'a-details-more', 'b', 'b-details', 'b-details-more']
  );
});

test('parses formatting, accents, and setext headings but not example code or JSX demos', () => {
  assert.deepEqual(
    index(`---
title: Example
---

## **Café** and \`Code\`

Setext heading
--------------

\`\`\`md
## Not a heading
\`\`\`

<ExampleDemo>

## Not a document section

</ExampleDemo>

## {dynamicTitle}
`),
    [
      {id: 'cafe-and-code', title: 'Café and Code', parents: []},
      {id: 'setext-heading', title: 'Setext heading', parents: []},
    ]
  );
});

test('emits exactly the indexed IDs in compiled MDX, without client deduplication', () => {
  const source = '## First\n### Details\n## Second\n### Details\n### Details';
  const {default: Content} = evaluateSync(source, {
    ...runtime,
    remarkPlugins: [remarkStoryHeadings],
  });
  const html = renderToStaticMarkup(runtime.jsx(Content, {}));
  const ids = [...html.matchAll(/id="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(
    ids,
    index(source).map(h => h.id)
  );
  assert.equal(new Set(ids).size, ids.length);
});

test('preserves explicit IDs supplied by an earlier plugin', () => {
  const tree = parser.parse('## Title');
  const heading = tree.children[0]!;
  heading.data = {hProperties: {id: 'custom-id'}};
  assert.equal(indexStoryHeadings(tree)[0]?.id, 'custom-id');
});

test('indexes every current MDX page and finds nested Badge components', () => {
  const appDir = new URL('../static/app/', import.meta.url);
  for (const file of fs.globSync('**/*.mdx', {cwd: appDir})) {
    const headings = index(fs.readFileSync(new URL(file, appDir), 'utf8'));
    assert.equal(new Set(headings.map(h => h.id)).size, headings.length, file);
    if (file === 'components/core/badge/badge.mdx') {
      assert(headings.some(h => h.title === 'FeatureBadge' && h.id === 'featurebadge'));
      assert(headings.some(h => h.title === 'Tag' && h.id === 'tag'));
    }
  }
});
