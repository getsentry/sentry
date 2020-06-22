import React from 'react';
import styled from '@emotion/styled';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
import {action} from '@storybook/addon-actions';
import {text} from '@storybook/addon-knobs';

import OptionSelector from 'app/components/charts/optionSelector';
import space from 'app/styles/space';

const options = [
  {value: 'all', label: 'All things'},
  {value: 'none', label: 'No things'},
  {value: 'top5', label: 'Top 5 things that is a much longer title'},
  {value: 'nope', disabled: true, label: 'Disabled option'},
  {value: 'more', label: 'Additional option'},
];

storiesOf('Charts|OptionSelector', module).add(
  'default',
  withInfo('Selector control for chart controls')(() => (
    <Container>
      <OptionSelector
        options={options}
        selected={text('selected', 'none')}
        title={text('title', 'Display')}
        menuWidth={text('menuWidth', '200px')}
        onChange={action('changed')}
      />
    </Container>
  ))
);

const Container = styled('div')`
  padding: ${space(2)} ${space(3)};
`;
