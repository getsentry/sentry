import {InfoText} from '@sentry/scraps/info';

import {t} from 'sentry/locale';

export function NotOpRow() {
  const label = t('Assert NOT');

  return (
    <InfoText title={label} mode="overflowOnly">
      {label}
    </InfoText>
  );
}
