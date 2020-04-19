import React from 'react';

import {IconCheckmark} from 'app/icons/iconCheckmark';
import {IconSubtract} from 'app/icons/iconSubtract';

type Props = {
  isChecked?: boolean;
  isIndeterminate?: boolean;
};

const CheckboxFancyContent = ({isChecked, isIndeterminate}: Props) => {
  if (isChecked) {
    return <IconCheckmark size="70%" color="white" />;
  }

  if (isIndeterminate) {
    return <IconSubtract size="70%" color="white" />;
  }

  return null;
};

export default CheckboxFancyContent;
