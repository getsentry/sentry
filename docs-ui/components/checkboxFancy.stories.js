import {withInfo} from '@storybook/addon-info';
import {number, boolean} from '@storybook/addon-knobs';
import styled from '@emotion/styled';

import CheckboxFancy from 'app/components/checkboxFancy/checkboxFancy';

export default {
  title: 'Core/Style/Icons',
};

export const _CheckboxFancy = withInfo('A fancy looking checkbox')(() => {
  return (
    <Container>
      <CheckboxFancy
        size={`${number('Size', 100)}px`}
        isChecked={boolean('Checked', true)}
      />
    </Container>
  );
});

_CheckboxFancy.story = {
  name: 'CheckboxFancy',
};

const Container = styled('div')`
  display: flex;
  flex-direction: column;
  padding: 20px;
`;
