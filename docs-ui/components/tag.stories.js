import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import Tooltip from 'app/components/tooltip';
import Tag from 'app/views/settings/components/tag';

storiesOf('UI|Tags', module)
  .add(
    'default',
    withInfo('A basic tag-like thing. If you pass no type, it will be gray')(() => (
      <Tag>Development</Tag>
    ))
  )
  .add(
    'warning',
    withInfo(
      'A warning tag-like thing. Use this to signal that something is maybe not so great'
    )(() => <Tag priority="warning">Development</Tag>)
  )
  .add(
    'success',
    withInfo('A happy tag-like thing. Use this to signal something good')(() => (
      <Tag priority="success">Development</Tag>
    ))
  )
  .add(
    'beta',
    withInfo(
      'An attention grabbing thing. Use this to communicate shiny new functionality.'
    )(() => (
      <Tooltip
        title="This feature is in beta and may change in the future."
        tooltipOptions={{
          placement: 'right',
        }}
      >
        <span>
          <Tag priority="beta">beta</Tag>
        </span>
      </Tooltip>
    ))
  )
  .add(
    'small',
    withInfo('A small tag-like thing. Use this when space is at a premium')(() => (
      <Tag size="small" border>
        new
      </Tag>
    ))
  )
  .add(
    'with icon',
    withInfo(
      'A tag-like thing with an icon. Use when you need to represent something'
    )(() => <Tag icon="icon-lock">Locked</Tag>)
  );
