import type {Location} from 'history';
import {EventFixture} from 'sentry-fixture/event';

import {initializeOrg} from 'sentry-test/initializeOrg';

import {
  EMPTY_HIGHLIGHT_DEFAULT,
  getHighlightContextData,
  getHighlightTagData,
} from 'sentry/components/events/highlights/util';

export const TEST_EVENT_CONTEXTS = {
  keyboard: {
    type: 'default',
    brand: 'keychron',
    percent: 75,
    switches: {
      form: 'tactile',
      brand: 'wuque studios',
    },
  },
  client_os: {
    type: 'os',
    name: 'Mac OS X',
    version: '10.15',
  },
  runtime: {
    type: 'runtime',
    name: 'CPython',
    version: '3.8.13',
  },
};

export const TEST_EVENT_TAGS = [
  {
    key: 'browser',
    value: 'Chrome 1.2.3',
  },
  {
    key: 'browser.name',
    value: 'Chrome',
  },
  {
    key: 'device.family',
    value: 'Mac',
  },
  {
    key: 'environment',
    value: 'production',
  },
  {
    key: 'handled',
    value: 'no',
  },
  {
    key: 'level',
    value: 'error',
  },
  {
    key: 'release',
    value: '1.8',
  },
  {
    key: 'runtime',
    value: 'CPython 3.8.13',
  },
  {
    key: 'runtime.name',
    value: 'CPython',
  },
  {
    key: 'url',
    value: 'https://example.com',
  },
];

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
    expect(highlightCtxData[0].alias).toBe('keyboard');
    expect(highlightCtxData[0].type).toBe('default');
    expect(highlightCtxData[0].data).toHaveLength(highlightContext.keyboard.length);
    const highlightCtxDataKeys = new Set(highlightCtxData[0].data.map(({key}) => key));
    for (const ctxKey of highlightContext.keyboard) {
      expect(highlightCtxDataKeys.has(ctxKey)).toBe(true);
    }
    const missingCtxHighlightFromEvent = highlightCtxData[0].data?.find(
      d => d.key === missingContextKey
    );
    expect(missingCtxHighlightFromEvent?.value).toBe(EMPTY_HIGHLIGHT_DEFAULT);
  });

  it.each([
    ['alias', {client_os: ['version']}],
    ['type', {os: ['version']}],
    ['title', {'Operating System': ['version']}],
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
    expect(highlightCtxData[0].type).toBe('os');
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
