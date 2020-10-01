import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import HelpSearch from 'app/components/helpSearch';

const mockResults = [
  {
    site: 'docs',
    name: 'Documentation',
    hits: [
      {
        id: 'SitePage /platforms/native/guides/minidumps/',
        site: 'docs',
        url: 'https://docs.sentry.io/platforms/native/guides/minidumps/',
        context: {context1: 'Platforms > Native > Guides > Minidumps'},
        title: 'Minidumps',
        text:
          'Sentry can process Minidump crash reports, a memory <mark>dump</mark> used on Windows and by\nopen …',
      },
      {
        id: 'SitePage /product/discover-queries/query-builder/',
        site: 'docs',
        url: 'https://docs.sentry.io/product/discover-queries/query-builder/',
        context: {context1: 'Product > Discover Queries > Query Builder'},
        title: 'Query Builder',
        text:
          '… conditions, see  Using  OR  &  AND  Conditions . Tag <mark>Summ</mark>ary Filters Every event has a list of …',
      },
    ],
  },
  {
    site: 'help-center',
    name: 'Help Center',
    hits: [],
  },
  {
    site: 'develop',
    name: 'Developer Documentation',
    hits: [
      {
        id: 'eee2b51a-7594-5f86-91db-267c15db5ef6',
        site: 'develop',
        url: 'https://develop.sentry.dev/services/digests/',
        context: {context1: 'Services > Digests'},
        title: 'Notification Digests',
        text:
          '… operation, especially on large data sets. Backends <mark>Dumm</mark>y Backend The <mark>dumm</mark>y backend disables digest scheduling …',
      },
    ],
  },
  {
    site: 'blog',
    name: 'Blog Posts',
    hits: [
      {
        id: 'ae61cfd6d4b462d24dd4622b8b7db274',
        site: 'blog',
        context: {context1: 'Building Sentry: Symbolicator'},
        url: 'https://blog.sentry.io/2019/06/13/building-a-sentry-symbolicator/',
        title: 'Stacking your cards frames',
        text:
          '… traces. Since iOS is particularly restrictive, we <mark>dump</mark>ed this information into a temporary location and …',
      },
    ],
  },
];

jest.mock('@sentry-internal/global-search', () => ({
  SentryGlobalSearch: jest
    .fn()
    .mockImplementation(() => ({query: () => Promise.resolve(mockResults)})),
}));

describe('HelpSearch', function () {
  it('produces search results', async function () {
    const wrapper = mountWithTheme(
      <HelpSearch
        entryPoint="sidebar_help"
        renderInput={({getInputProps}) => <input {...getInputProps({type: 'text'})} />}
      />
    );

    wrapper.find('input').simulate('change', {target: {value: 'dummy'}});
    await tick();
    wrapper.update();

    expect(wrapper.find('SectionHeading')).toHaveLength(4);
    expect(wrapper.find('SearchResultWrapper')).toHaveLength(4);
    expect(wrapper.find('HighlightMarker')).toHaveLength(5);
  });
});
