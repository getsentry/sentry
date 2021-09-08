import {forwardRef} from 'react';
import ReactSelect from 'react-select';

import SelectControl, {ControlProps} from 'app/components/forms/selectControl';

export type MultiControlProps = ControlProps & {multiple: true};

export default forwardRef<ReactSelect, MultiControlProps>(function MultiSelectControl(
  props,
  ref
) {
  return <SelectControl forwardedRef={ref} {...props} multiple />;
});
