import React from 'react';

import {t} from 'app/locale';

type Props = {
  mapUrl?: string;
  map: string;
};

// TODO(Priscila): Remove BR tags
// mapUrl not always present; e.g. uploaded source maps
const FrameDefaultTitleOriginalSourceInfo = ({mapUrl, map}: Props) => (
  <React.Fragment>
    <strong>{t('Source Map')}</strong>
    <br />
    {mapUrl ? mapUrl : map}
    <br />
  </React.Fragment>
);

export default FrameDefaultTitleOriginalSourceInfo;
