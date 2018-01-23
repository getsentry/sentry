import React from 'react';
import InlineSvg from '../../../../components/inlineSvg';

const SubmitOnReturnButton = props => {
  return (
    <div {...props}>
      <InlineSvg size="12px" src="icon-return-key" />
    </div>
  );
};

export default SubmitOnReturnButton;
