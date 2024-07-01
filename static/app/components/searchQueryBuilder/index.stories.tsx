import {Fragment} from 'react';
import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import type {FilterKeySection} from 'sentry/components/searchQueryBuilder/types';
import SizingWindow from 'sentry/components/stories/sizingWindow';
import storyBook from 'sentry/stories/storyBook';
import {FieldKey, FieldKind} from 'sentry/utils/fields';

const FITLER_KEY_SECTIONS: FilterKeySection[] = [
  {
    value: FieldKind.FIELD,
    label: 'Category 1',
    children: [
      {key: FieldKey.AGE, name: 'Age', kind: FieldKind.FIELD},
      {
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
      {
        key: FieldKey.BROWSER_NAME,
        name: 'Browser Name',
        kind: FieldKind.FIELD,
        predefined: true,
        values: ['Chrome', 'Firefox', 'Safari', 'Edge'],
      },
    ],
  },
  {
    value: FieldKind.TAG,
    label: 'Category 2',
    children: [
      {
        key: 'custom_tag_name',
        name: 'Custom_Tag_Name',
        values: ['tag value one', 'tag value two', 'tag value three'],
      },
    ],
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
            getTagValues={getTagValues}
          />
        </MinHeightSizingWindow>
      </Fragment>
    );
  });
});

const MinHeightSizingWindow = styled(SizingWindow)`
  min-height: 500px;
  align-items: flex-start;
`;
