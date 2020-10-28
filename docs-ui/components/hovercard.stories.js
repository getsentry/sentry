import React from 'react';
import {withInfo} from '@storybook/addon-info';
import {text, select} from '@storybook/addon-knobs';

import Hovercard from 'app/components/hovercard';

const positionOptions = {
  top: 'top',
  bottom: 'bottom',
  left: 'left',
  right: 'right',
};

const showOptions = {
  true: true,
  false: false,
  null: null,
};

const tipColorOptions = {
  red: 'red',
  null: null,
};

export default {
  title: 'Core/Tooltips/Hovercard',
};

export const _Hovercard = withInfo(
  'Good luck if your container element is near the top and/or left side of the screen'
)(() => (
  <div
    style={{
      height: 300,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    }}
  >
    <Hovercard
      header={text('Header', 'Hovercard Header')}
      body={text('Body', 'Hovercard body (can also be a React node)')}
      position={select('position', positionOptions, 'top', 'Hovercard positioning')}
      show={select('show', showOptions, null, 'Force show/unshow')}
      tipColor={select('tipColor', tipColorOptions, null, 'Tip color')}
    >
      Hover over me
    </Hovercard>
  </div>
));
