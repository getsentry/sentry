import React from 'react';

const Checkbox = (props: React.HTMLProps<HTMLInputElement>) => (
  <input type="checkbox" {...props} />
);

Checkbox.defaultProps = {
  checked: false,
};

export default Checkbox;
