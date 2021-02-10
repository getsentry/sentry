import React from 'react';
import ReactSelect from 'react-select';

import SelectControl, {ControlProps} from 'app/components/forms/selectControl';
import {SelectValue} from 'app/types';

type Props = Omit<ControlProps, 'onChange'> & {
  /**
   * Triggered when values change.
   */
  onChange?: (value: SelectValue<any>[] | null | undefined) => void;
};

export default React.forwardRef<ReactSelect, Props>(function MultiSelectControl(
  props,
  ref
) {
  return <SelectControl forwardedRef={ref} {...props} multiple />;
});
