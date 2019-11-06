import React from 'react';

import SelectControl from 'app/components/forms/selectControl';

export default React.forwardRef(function MultiSelectControl(props, ref) {
  return <SelectControl forwardedRef={ref} {...props} multiple />;
});
