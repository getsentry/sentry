import React from 'react';
import {array, boolean, color, number} from '@storybook/addon-knobs';

import ScoreBar from 'app/components/scoreBar';

export default {
  title: 'DataVisualization/ScoreBar',
};

export const Horizontal = () => (
  <div style={{backgroundColor: 'white', padding: 12}}>
    <ScoreBar
      vertical={boolean('Vertical', false)}
      size={number('Size')}
      thickness={number('Thickness')}
      score={number('Score', 3)}
    />
  </div>
);

Horizontal.storyName = 'horizontal';

export const Vertical = () => {
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
};

Vertical.storyName = 'vertical';

export const CustomPalette = () => {
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
};

CustomPalette.storyName = 'custom palette';
