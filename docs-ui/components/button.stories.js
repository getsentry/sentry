import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
import {action} from '@storybook/addon-actions';

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
          <Button primary onClick={action('click primary')}>
            Primary Button
          </Button>
        </Item>

        <Item>
          <Button danger onClick={action('click danger')}>
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
          <Button xsmall>
            Extra Small
          </Button>
        </Item>

        <Item>
          <Button small>
            Small
          </Button>
        </Item>

        <Item>
          <Button>
            Normal
          </Button>
        </Item>

        <Item>
          <Button large>
            Large
          </Button>
        </Item>
      </div>
    ))
  );
