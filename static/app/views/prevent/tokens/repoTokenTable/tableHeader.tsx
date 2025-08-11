import type {Sort} from 'sentry/utils/discover/fields';
import SortableHeader from 'sentry/views/prevent/tests/testAnalyticsTable/sortableHeader';
import type {Column} from 'sentry/views/prevent/tokens/repoTokenTable/repoTokenTable';

type TableHeaderParams = {
  column: Column;
  sort?: Sort;
};

export const renderTableHeader = ({column, sort}: TableHeaderParams) => {
  const {key, name} = column;

  return (
    <SortableHeader
      alignment={key === 'token' ? 'right' : 'left'}
      sort={sort}
      fieldName={key}
      label={name}
      enableToggle={false}
    />
  );
};
