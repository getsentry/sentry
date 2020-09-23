import React from 'react';
import {withInfo} from '@storybook/addon-info';
import {number, boolean, array, color} from '@storybook/addon-knobs';

import ScoreBar from 'app/components/scoreBar';

export default {
  title: 'DataVisualization/ScoreBar',
};

export const Horizontal = withInfo('Description')(() => (
  <div style={{backgroundColor: 'white', padding: 12}}>
    <ScoreBar
      vertical={boolean('Vertical', false)}
      size={number('Size')}
      thickness={number('Thickness')}
      score={number('Score', 3)}
    />
  </div>
));

Horizontal.story = {
  name: 'horizontal',
};

export const Vertical = withInfo('Description')(() => {
  return (
    <div style={{backgroundColor: 'white', padding: 12}}>
      <ScoreBar
        vertical={boolean('Vertical', true)}
        size={number('Size')}
        thickness={number('Thickness')}
        score={number('Score', 3)}
      />
    </div>
  );
});

Vertical.story = {
  name: 'vertical',
};

export const CustomPalette = withInfo('Description')(() => {
  const palette = array('Palette', [
    color('Lower', 'pink'),
    color('Low', 'yellow'),
    color('Med', 'lime'),
    color('High', 'blue'),
    color('Higher', 'purple'),
  ]);

  return (
    <div style={{backgroundColor: 'white', padding: 12}}>
      <ScoreBar
        vertical={boolean('Vertical', false)}
        size={number('Size')}
        thickness={number('Thickness')}
        score={number('Score', 3)}
        palette={palette}
      />
    </div>
  );
});

CustomPalette.story = {
  name: 'custom palette',
};
