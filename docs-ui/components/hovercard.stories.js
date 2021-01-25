import React from 'react';
import {select, text} from '@storybook/addon-knobs';

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

// TODO(scttcper): Hovercard not working
export default {
  title: 'Core/Tooltips/Hovercard',
  component: Hovercard,
};

export const _Hovercard = () => (
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
);
_Hovercard.parameters = {
  docs: {
    description: {
      story:
        'Good luck if your container element is near the top and/or left side of the screen',
    },
  },
};
