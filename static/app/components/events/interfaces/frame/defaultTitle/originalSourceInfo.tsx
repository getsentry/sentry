import {Fragment} from 'react';

import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';

type Props = {
  map?: string | null;
  mapUrl?: string | null;
};

// TODO(Priscila): Remove BR tags
// mapUrl not always present; e.g. uploaded source maps
function OriginalSourceInfo({mapUrl, map}: Props) {
  if (!defined(map) && !defined(mapUrl)) {
    return null;
  }

  return (
    <Fragment>
      <strong>{t('Source Map')}</strong>
      <br />
      {mapUrl ?? map}
      <br />
    </Fragment>
  );
}

export default OriginalSourceInfo;
