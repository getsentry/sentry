import {Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import type {Sort} from 'sentry/utils/discover/fields';
import {
  SORTABLE_FIELDS,
  type Column,
} from 'sentry/views/prevent/tokens/repoTokenTable/repoTokenTable';
import TokensSortableHeader from 'sentry/views/prevent/tokens/repoTokenTable/tokensSortableHeader';

type TableHeaderParams = {
  column: Column;
  sort?: Sort;
};

export const renderTableHeader = ({column, sort}: TableHeaderParams) => {
  const {key, name} = column;
  const isSortable = SORTABLE_FIELDS.includes(key as (typeof SORTABLE_FIELDS)[number]);

  if (isSortable) {
    return <TokensSortableHeader sort={sort} fieldName={key} label={name} />;
  }

  return (
    <Flex justify="end" width="100%">
      <Text as="span" size="sm">
        {name}
      </Text>
    </Flex>
  );
};
