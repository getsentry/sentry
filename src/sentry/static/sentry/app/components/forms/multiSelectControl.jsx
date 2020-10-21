import {forwardRef} from 'react';

import SelectControl from 'app/components/forms/selectControl';

export default forwardRef(function MultiSelectControl(props, ref) {
  return <SelectControl forwardedRef={ref} {...props} multiple />;
});
