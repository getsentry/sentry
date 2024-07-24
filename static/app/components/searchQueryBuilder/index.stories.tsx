import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import MultipleCheckbox from 'sentry/components/forms/controls/multipleCheckbox';
import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import type {FilterKeySection} from 'sentry/components/searchQueryBuilder/types';
import SizingWindow from 'sentry/components/stories/sizingWindow';
import storyBook from 'sentry/stories/storyBook';
import type {TagCollection} from 'sentry/types/group';
import {FieldKey, FieldKind, MobileVital, WebVital} from 'sentry/utils/fields';

const FILTER_KEYS: TagCollection = {
  [FieldKey.AGE]: {key: FieldKey.AGE, name: 'Age', kind: FieldKind.FIELD},
  [FieldKey.ASSIGNED]: {
    key: FieldKey.ASSIGNED,
    name: 'Assigned To',
    kind: FieldKind.FIELD,
    predefined: true,
    values: [
      {
        title: 'Suggested',
        type: 'header',
        icon: null,
        children: [{value: 'me'}, {value: 'unassigned'}],
      },
      {
        title: 'All',
        type: 'header',
        icon: null,
        children: [{value: 'person1@sentry.io'}, {value: 'person2@sentry.io'}],
      },
    ],
  },
  [FieldKey.BROWSER_NAME]: {
    key: FieldKey.BROWSER_NAME,
    name: 'Browser Name',
    kind: FieldKind.FIELD,
    predefined: true,
    values: ['Chrome', 'Firefox', 'Safari', 'Edge'],
  },
  [FieldKey.IS]: {
    key: FieldKey.IS,
    name: 'is',
    predefined: true,
    values: ['resolved', 'unresolved', 'ignored'],
  },
  [FieldKey.TIMES_SEEN]: {
    key: FieldKey.TIMES_SEEN,
    name: 'timesSeen',
    kind: FieldKind.FIELD,
  },
  [WebVital.LCP]: {
    key: WebVital.LCP,
    name: 'lcp',
    kind: FieldKind.FIELD,
  },
  [MobileVital.FRAMES_SLOW_RATE]: {
    key: MobileVital.FRAMES_SLOW_RATE,
    name: 'framesSlowRate',
    kind: FieldKind.FIELD,
  },
  custom_tag_name: {
    key: 'custom_tag_name',
    name: 'Custom_Tag_Name',
  },
};

const FITLER_KEY_SECTIONS: FilterKeySection[] = [
  {
    value: FieldKind.FIELD,
    label: 'Category 1',
    children: [
      FieldKey.AGE,
      FieldKey.ASSIGNED,
      FieldKey.BROWSER_NAME,
      FieldKey.IS,
      FieldKey.TIMES_SEEN,
      WebVital.LCP,
      MobileVital.FRAMES_SLOW_RATE,
    ],
  },
  {
    value: FieldKind.TAG,
    label: 'Category 2',
    children: ['custom_tag_name'],
  },
];

const getTagValues = (): Promise<string[]> => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(['tag value one', 'tag value two', 'tag value three']);
    }, 500);
  });
};

export default storyBook(SearchQueryBuilder, story => {
  story('Default', () => {
    return (
      <Fragment>
        <Alert type="warning">This component and story is a WIP.</Alert>
        <MinHeightSizingWindow>
          <SearchQueryBuilder
            initialQuery="browser.name:Firefox assigned:me custom_tag_name:123"
            filterKeySections={FITLER_KEY_SECTIONS}
            filterKeys={FILTER_KEYS}
            getTagValues={getTagValues}
            searchSource="storybook"
          />
        </MinHeightSizingWindow>
      </Fragment>
    );
  });

  story('Config Options', () => {
    const configs = [
      'disallowFreeText',
      'disallowLogicalOperators',
      'disallowWildcard',
      'disallowUnsupportedFilters',
    ];

    const [enabledConfigs, setEnabledConfigs] = useState<string[]>([...configs]);
    const queryBuilderOptions = enabledConfigs.reduce((acc, config) => {
      acc[config] = true;
      return acc;
    }, {});

    return (
      <Fragment>
        <p>
          There are some config options which allow you to customize which types of syntax
          are considered valid. This should be used when the search backend does not
          support certain operators like boolean logic or wildcards.
        </p>
        <MultipleCheckbox
          onChange={setEnabledConfigs}
          value={enabledConfigs}
          name="enabled configs"
        >
          {configs.map(config => (
            <MultipleCheckbox.Item key={config} value={config}>
              {config}
            </MultipleCheckbox.Item>
          ))}
        </MultipleCheckbox>
        <SearchQueryBuilder
          initialQuery="(unsupported_key:value OR browser.name:Internet*) TypeError"
          filterKeySections={FITLER_KEY_SECTIONS}
          filterKeys={FILTER_KEYS}
          getTagValues={getTagValues}
          searchSource="storybook"
          {...queryBuilderOptions}
        />
      </Fragment>
    );
  });
});

const MinHeightSizingWindow = styled(SizingWindow)`
  min-height: 500px;
  align-items: flex-start;
`;
