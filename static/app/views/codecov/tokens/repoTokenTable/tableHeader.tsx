import type {Sort} from 'sentry/utils/discover/fields';
import SortableHeader from 'sentry/views/codecov/tests/testAnalyticsTable/sortableHeader';
import type {Column} from 'sentry/views/codecov/tokens/repoTokenTable/repoTokenTable';

type TableHeaderParams = {
  column: Column;
  sort?: Sort;
};

export const renderTableHeader = ({column, sort}: TableHeaderParams) => {
  const {key, name} = column;

  const alignment = key === 'token' ? 'right' : 'left';

  return (
    <SortableHeader
      alignment={alignment}
      sort={sort}
      fieldName={key}
      label={name}
      enableToggle={false}
      hasRadio={key === 'name'}
    />
  );
};
