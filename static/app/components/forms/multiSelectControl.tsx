import {forwardRef} from 'react';
import ReactSelect from 'react-select';

import SelectControl, {ControlProps} from 'app/components/forms/selectControl';
import {SelectValue} from 'app/types';

export type MultiControlProps = Omit<ControlProps, 'onChange'> & {
  /**
   * Triggered when values change.
   */
  onChange?: (value?: SelectValue<any>[] | null) => void;
};

export default forwardRef<ReactSelect, MultiControlProps>(function MultiSelectControl(
  props,
  ref
) {
  return <SelectControl forwardedRef={ref} {...props} multiple />;
});
