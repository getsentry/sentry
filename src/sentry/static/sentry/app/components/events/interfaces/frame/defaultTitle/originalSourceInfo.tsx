import { Fragment } from 'react';

import {t} from 'app/locale';
import {defined} from 'app/utils';

type Props = {
  map?: string | null;
  mapUrl?: string | null;
};

// TODO(Priscila): Remove BR tags
// mapUrl not always present; e.g. uploaded source maps
const OriginalSourceInfo = ({mapUrl, map}: Props) => {
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
};

export default OriginalSourceInfo;
