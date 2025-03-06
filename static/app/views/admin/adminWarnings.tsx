import {Fragment} from 'react';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {useApiQuery} from 'sentry/utils/queryClient';

type Data = {
  groups: Array<[groupName: string, grouppedWarnings: string[]]>;
  warnings: string[];
};

function AdminWarnings() {
  const {data, isPending, isError} = useApiQuery<Data>(['/internal/warnings/'], {
    staleTime: 0,
  });

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (!data || isError) {
    return null;
  }

  const {groups, warnings} = data;

  return (
    <div>
      <h3>{t('System Warnings')}</h3>
      {!warnings && !groups && t('There are no warnings at this time')}

      {groups.map(([groupName, groupedWarnings]) => (
        <Fragment key={groupName}>
          <h4>{groupName}</h4>
          <ul>
            {groupedWarnings.map((warning, i) => (
              <li key={i}>{warning}</li>
            ))}
          </ul>
        </Fragment>
      ))}

      {warnings.length > 0 && (
        <Fragment>
          <h4>{t('Miscellaneous')}</h4>
          <ul>
            {warnings.map((warning, i) => (
              <li key={i}>{warning}</li>
            ))}
          </ul>
        </Fragment>
      )}
    </div>
  );
}

export default AdminWarnings;
