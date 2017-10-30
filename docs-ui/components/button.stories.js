import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
import {action} from '@storybook/addon-actions';
import {boolean} from '@storybook/addon-knobs';

import Button from 'sentry-ui/buttons/button';

const Item = ({children}) => <span style={{padding: 12}}>{children}</span>;

// eslint-disable-next-line
storiesOf('Buttons', module)
  .add(
    'priorities',
    withInfo('Different button priorities')(() => (
      <div>
        <Item>
          <Button to="/test" onClick={action('clicked default')}>
            Default Button
          </Button>
        </Item>

        <Item>
          <Button priority="primary" onClick={action('click primary')}>
            Primary Button
          </Button>
        </Item>

        <Item>
          <Button priority="danger" onClick={action('click danger')}>
            Danger Button
          </Button>
        </Item>

        <Item>
          <Button to={''} disabled onClick={action('click disabled')}>
            Disabled Button
          </Button>
        </Item>
      </div>
    ))
  )
  .add(
    'sizes',
    withInfo('Different buttons sizes')(() => (
      <div>
        <Item>
          <Button size="xsmall">Extra Small</Button>
        </Item>

        <Item>
          <Button size="small">Small</Button>
        </Item>

        <Item>
          <Button>Normal</Button>
        </Item>

        <Item>
          <Button size="large">Large</Button>
        </Item>
      </div>
    ))
  )
  .add(
    'states',
    withInfo('Different button states')(() => (
      <div style={{display: 'flex', alignItems: 'center'}}>
        <Item>
          <Button
            busy={boolean('Extra Small Busy', true)}
            priority="primary"
            size="xsmall"
          >
            Extra Small
          </Button>
        </Item>

        <Item>
          <Button busy={boolean('Small Busy', true)} priority="primary" size="small">
            Small
          </Button>
        </Item>

        <Item>
          <Button busy={boolean('Normal Busy', true)} priority="primary">
            Normal
          </Button>
        </Item>

        <Item>
          <Button busy={boolean('Large Busy', true)} priority="primary" size="large">
            Large
          </Button>
        </Item>

        <Item>
          <Button priority="primary" disabled onClick={action('click disabled')}>
            Disabled Button
          </Button>
        </Item>
      </div>
    ))
  );
