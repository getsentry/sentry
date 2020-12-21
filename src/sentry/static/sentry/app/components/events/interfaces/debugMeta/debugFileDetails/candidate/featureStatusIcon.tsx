import React from 'react';

import {IconCheckmark, IconClose} from 'app/icons';

type Props = {
  status: boolean;
};

function FeatureStatusIcon({status}: Props) {
  if (status) {
    <IconCheckmark color="green300" size="xs" />;
  }

  return <IconClose color="red300" size="xs" />;
}

export default FeatureStatusIcon;
