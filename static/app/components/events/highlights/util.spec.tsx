import type {Location} from 'history';
import {EventFixture} from 'sentry-fixture/event';

import {initializeOrg} from 'sentry-test/initializeOrg';

import {
  EMPTY_HIGHLIGHT_DEFAULT,
  getHighlightContextData,
  getHighlightTagData,
  getRuntimeLabelAndTooltip,
} from 'sentry/components/events/highlights/util';

import {TEST_EVENT_CONTEXTS, TEST_EVENT_TAGS} from './testUtils';

describe('getHighlightContextData', () => {
  it('returns only highlight context data', () => {
    const {organization, project} = initializeOrg();
    const event = EventFixture({
      contexts: TEST_EVENT_CONTEXTS,
    });
    const missingContextKey = 'color';
    const highlightContext = {
      keyboard: ['brand', 'switches', missingContextKey],
    };
    const highlightCtxData = getHighlightContextData({
      event,
      highlightContext,
      project,
      organization,
      location: {query: {}} as Location,
    });
    expect(highlightCtxData).toHaveLength(1);
    expect(highlightCtxData[0]!.alias).toBe('keyboard');
    expect(highlightCtxData[0]!.type).toBe('default');
    expect(highlightCtxData[0]!.data).toHaveLength(highlightContext.keyboard.length);
    const highlightCtxDataKeys = new Set(highlightCtxData[0]!.data.map(({key}) => key));
    for (const ctxKey of highlightContext.keyboard) {
      expect(highlightCtxDataKeys.has(ctxKey)).toBe(true);
    }
    const missingCtxHighlightFromEvent = highlightCtxData[0]!.data?.find(
      d => d.key === missingContextKey
    );
    expect(missingCtxHighlightFromEvent?.value).toBe(EMPTY_HIGHLIGHT_DEFAULT);
  });

  it.each([
    ['alias', {client_os: ['version']}],
    ['type', {os: ['version']}],
    ['title', {'Client Operating System': ['version']}],
  ])('matches highlights on context %s', (_type, highlightContext) => {
    const {organization, project} = initializeOrg();
    const event = EventFixture({
      contexts: TEST_EVENT_CONTEXTS,
    });
    const highlightCtxData = getHighlightContextData({
      event,
      highlightContext,
      project,
      organization,
      location: {query: {}} as Location,
    });
    expect(highlightCtxData).toHaveLength(1);
    expect(highlightCtxData[0]!.type).toBe('os');
  });
});

describe('getHighlightTagData', () => {
  it('returns only highlight tag data', () => {
    const event = EventFixture({
      tags: TEST_EVENT_TAGS,
    });
    const missingTag = 'zamboni';
    const highlightTags = ['release', 'url', 'environment', missingTag];
    const highlightTagsSet = new Set(highlightTags);

    const highlightTagData = getHighlightTagData({event, highlightTags});

    expect(highlightTagData).toHaveLength(highlightTagsSet.size);
    for (const content of highlightTagData) {
      expect(highlightTagsSet.has(content.originalTag.key)).toBe(true);
    }
    const missingTagHighlightFromEvent = highlightTagData.find(
      td => td.originalTag.key === missingTag
    );
    expect(missingTagHighlightFromEvent?.value).toBe(EMPTY_HIGHLIGHT_DEFAULT);
  });
});

describe('getRuntimeLabel', () => {
  it('returns null for non-JavaScript SDK events', () => {
    const event = EventFixture({
      type: 'error',
      sdk: {name: 'python'},
    });

    expect(getRuntimeLabelAndTooltip(event)).toBeNull();
  });

  it('returns null for javascript issues without context information', () => {
    const event = EventFixture({
      type: 'error',
      sdk: {name: 'javascript'},
    });

    expect(getRuntimeLabelAndTooltip(event)).toBeNull();
  });

  it('returns inferred runtime from browser context', () => {
    const frontendEvent = EventFixture({
      type: 'error',
      sdk: {name: 'javascript'},
      contexts: {
        browser: {name: 'Chrome'},
      },
    });

    expect(getRuntimeLabelAndTooltip(frontendEvent)?.label).toBe('Frontend');
    expect(getRuntimeLabelAndTooltip(frontendEvent)?.tooltip).toBe(
      'Error from Chrome browser'
    );
  });

  it.each([
    ['node', 'Error from Node.js Server Runtime'],
    ['bun', 'Error from Bun Server Runtime'],
    ['deno', 'Error from Deno Server Runtime'],
    ['cloudflare', 'Error from Cloudflare Workers'],
    ['vercel-edge', 'Error from Vercel Edge Runtime'],
  ])(
    'returns correct runtime label and tooltip for %s runtime',
    (runtimeName, expectedTooltip) => {
      const event = EventFixture({
        type: 'error',
        sdk: {name: 'javascript'},
        contexts: {
          runtime: {name: runtimeName},
          browser: {name: 'Chrome'}, // Backend events might also have 'browser'
        },
      });

      const result = getRuntimeLabelAndTooltip(event);
      expect(result?.label).toBe('Backend');
      expect(result?.tooltip).toBe(expectedTooltip);
    }
  );

  it('returns null when no runtime can be determined', () => {
    const event = EventFixture({
      type: 'error',
      sdk: {name: 'javascript'},
      contexts: {}, // No browser or runtime context
    });

    expect(getRuntimeLabelAndTooltip(event)).toBeNull();
  });

  it('returns null when it is not an error event', () => {
    const event = EventFixture({
      type: 'transaction',
      sdk: {name: 'javascript'},
      contexts: {
        browser: {name: 'Chrome'},
      },
    });

    expect(getRuntimeLabelAndTooltip(event)).toBeNull();
  });
});
