import React from 'react';
import styled from '@emotion/styled';

import CheckboxFancy from 'app/components/checkboxFancy/checkboxFancy';

export default {
  title: 'Core/Style/Icons',
  component: CheckboxFancy,
  args: {
    size: 100,
    isChecked: true,
  },
};

export const _CheckboxFancy = ({size, isChecked}) => {
  return (
    <Container>
      <CheckboxFancy size={`${size}px`} isChecked={isChecked} />
    </Container>
  );
};

_CheckboxFancy.storyName = 'CheckboxFancy';
_CheckboxFancy.parameters = {
  docs: {
    description: {
      story: 'A fancy looking checkbox',
    },
  },
};

const Container = styled('div')`
  display: flex;
  flex-direction: column;
  padding: 20px;
`;
