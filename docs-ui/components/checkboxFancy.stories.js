import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
import {number, boolean} from '@storybook/addon-knobs';
import styled from 'react-emotion';

import CheckboxFancy from 'app/components/checkboxFancy';

storiesOf('Style|Icons', module).add(
  'CheckboxFancy',
  withInfo('A fancy looking checkbox')(() => {
    return (
      <Container>
        <CheckboxFancy
          size={`${number('Size', 100)}px`}
          checked={boolean('Checked', true)}
        />
      </Container>
    );
  })
);

const Container = styled('div')`
  display: flex;
  flex-direction: column;
  padding: 20px;
`;
