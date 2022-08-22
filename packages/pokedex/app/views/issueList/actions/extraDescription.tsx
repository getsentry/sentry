import {t, tct} from 'sentry/locale';

import {BULK_LIMIT, BULK_LIMIT_STR} from './utils';

type Props = {
  all: boolean;
  query: string;
  queryCount: number;
};

function ExtraDescription({all, query, queryCount}: Props) {
  if (!all) {
    return null;
  }

  if (query) {
    return (
      <div>
        <p>{t('This will apply to the current search query') + ':'}</p>
        <pre>{query}</pre>
      </div>
    );
  }

  return (
    <p className="error">
      <strong>
        {queryCount > BULK_LIMIT
          ? tct(
              'This will apply to the first [bulkNumber] issues matched in this project!',
              {
                bulkNumber: BULK_LIMIT_STR,
              }
            )
          : tct('This will apply to all [bulkNumber] issues matched in this project!', {
              bulkNumber: queryCount,
            })}
      </strong>
    </p>
  );
}

export default ExtraDescription;
