import {NAMESPACE_FILTER_KEY_PREFIX} from 'sentry/actionCreators/savedSearches';
import {createRecentQueryItem} from 'sentry/components/searchQueryBuilder/tokens/filterKeyListBox/utils';
import {SavedSearchType} from 'sentry/types/group';
import {FieldKind, FieldValueType} from 'sentry/utils/fields';

describe('createRecentFilterItem', () => {
  it('should strip the namespace filter key from the query if provided', () => {
    const item = createRecentQueryItem({
      namespaceFilterKey: 'namespacedKey',
      search: {
        query: `${NAMESPACE_FILTER_KEY_PREFIX}:namespacedKey test`,
        dateCreated: '',
        id: '1',
        lastSeen: '',
        organizationId: '1',
        type: SavedSearchType.TRACEMETRIC,
      },
      filterKeys: {},
      getFieldDefinition: () => ({
        kind: FieldKind.FIELD,
        valueType: FieldValueType.STRING,
      }),
    });
    expect(item.value).toBe('test');
  });
});
