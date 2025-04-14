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

describe('getHighlightContextData', function () {
  it('returns only highlight context data', function () {
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

describe('getHighlightTagData', function () {
  it('returns only highlight tag data', function () {
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

describe('getRuntimeLabel', function () {
  it('returns null for non-JavaScript SDK events', function () {
    const event = EventFixture({
      sdk: {name: 'python'},
    });

    expect(getRuntimeLabelAndTooltip(event)).toBeNull();
  });

  it('returns explicitly set runtime type', function () {
    const backendEvent = EventFixture({
      sdk: {name: 'javascript'},
    });

    expect(getRuntimeLabelAndTooltip(backendEvent, 'backend')?.label).toBe('Backend');

    const frontendEvent = EventFixture({
      sdk: {name: 'javascript'},
    });

    expect(getRuntimeLabelAndTooltip(frontendEvent, 'frontend')?.label).toBe('Frontend');
  });

  it('returns inferred runtime', function () {
    const frontedEvent = EventFixture({
      sdk: {name: 'javascript'},
      contexts: {
        browser: {name: 'Chrome'},
      },
    });

    expect(getRuntimeLabelAndTooltip(frontedEvent)?.label).toBe('Frontend');

    const serverlessEvent = EventFixture({
      sdk: {name: 'javascript'},
      contexts: {
        runtime: {name: 'node'},
        browser: {name: 'Chrome'}, // Backend events also have 'browser'
        cloud_resource: {['cloud.provider']: 'cloudflare', type: 'default'},
      },
    });

    expect(getRuntimeLabelAndTooltip(serverlessEvent)?.label).toBe('Backend');

    const backendEvent = EventFixture({
      sdk: {name: 'javascript'},
      contexts: {
        runtime: {name: 'node'},
        browser: {name: 'Chrome'}, // Backend events also have 'browser'
      },
    });

    expect(getRuntimeLabelAndTooltip(backendEvent)?.label).toBe('Backend');
  });

  it('returns null when no runtime can be determined', function () {
    const event = EventFixture({
      sdk: {name: 'javascript'},
      contexts: {}, // No browser or runtime context
    });

    expect(getRuntimeLabelAndTooltip(event)).toBeNull();
  });
});
