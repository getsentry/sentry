import {Fragment} from 'react';
import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import SizingWindow from 'sentry/components/stories/sizingWindow';
import storyBook from 'sentry/stories/storyBook';
import type {TagCollection} from 'sentry/types';
import {FieldKey, FieldKind} from 'sentry/utils/fields';

const SUPPORTED_KEYS: TagCollection = {
  [FieldKey.AGE]: {
    key: FieldKey.AGE,
    name: 'Age',
    kind: FieldKind.FIELD,
    predefined: true,
  },
  [FieldKey.ASSIGNED]: {
    key: FieldKey.ASSIGNED,
    name: 'Assigned To',
    kind: FieldKind.FIELD,
    predefined: true,
    values: ['me', 'unassigned', 'person@sentry.io'],
  },
  [FieldKey.BROWSER_NAME]: {
    key: FieldKey.BROWSER_NAME,
    name: 'Browser Name',
    kind: FieldKind.FIELD,
    predefined: true,
    values: ['Chrome', 'Firefox', 'Safari', 'Edge'],
  },
  custom_tag_name: {key: 'custom_tag_name', name: 'Custom_Tag_Name', kind: FieldKind.TAG},
};

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
            supportedKeys={SUPPORTED_KEYS}
            getTagValues={getTagValues}
          />
        </MinHeightSizingWindow>
      </Fragment>
    );
  });
});

const MinHeightSizingWindow = styled(SizingWindow)`
  min-height: 500px;
`;
