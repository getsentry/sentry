import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
import {number, boolean, array, color} from '@storybook/addon-knobs';

import ScoreBar from 'app/components/scoreBar';

storiesOf('Other|ScoreBar', module)
  .add(
    'horizontal',
    withInfo('Description')(() => (
      <div style={{backgroundColor: 'white', padding: 12}}>
        <ScoreBar
          vertical={boolean('Vertical', false)}
          size={number('Size')}
          thickness={number('Thickness')}
          score={number('Score', 3)}
        />
      </div>
    ))
  )
  .add(
    'vertical',
    withInfo('Description')(() => {
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
    })
  )
  .add(
    'custom palette',
    withInfo('Description')(() => {
      let palette = array('Palette', [
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
    })
  );
