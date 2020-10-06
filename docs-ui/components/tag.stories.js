import React from 'react';
import {withInfo} from '@storybook/addon-info';

import Tooltip from 'app/components/tooltip';
import Tag from 'app/components/tag-deprecated';

export default {
  title: 'Core/Badges+Tags/Tag',
};

export const Overview = withInfo({
  text: 'An overview of all the different tags and states',
})(() => (
  <React.Fragment>
    <div>
      <Tag>default</Tag>
    </div>
    <div>
      <Tag priority="error">error</Tag>
    </div>
    <div>
      <Tag priority="warning">warning</Tag>
    </div>
    <div>
      <Tag priority="success">success</Tag>
    </div>
    <div>
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
    </div>
    <div>
      <Tag priority="new">new</Tag>
    </div>
    <div>
      <Tag priority="alpha">alpha</Tag>
    </div>
  </React.Fragment>
));

export const Default = withInfo(
  'A basic tag-like thing. If you pass no type, it will be gray'
)(() => <Tag>Development</Tag>);

Default.story = {
  name: 'default',
};

export const Warning = withInfo(
  'A warning tag-like thing. Use this to signal that something is maybe not so great'
)(() => <Tag priority="warning">Development</Tag>);

Warning.story = {
  name: 'warning',
};

export const Success = withInfo(
  'A happy tag-like thing. Use this to signal something good'
)(() => <Tag priority="success">Development</Tag>);

Success.story = {
  name: 'success',
};

export const Beta = withInfo(
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
));

Beta.story = {
  name: 'beta',
};

export const New = withInfo(
  'An attention grabbing thing. Use this to communicate shiny new functionality.'
)(() => (
  <Tooltip
    title="This feature is new and may change in the future."
    tooltipOptions={{
      placement: 'right',
    }}
  >
    <span>
      <Tag priority="new">new</Tag>
    </span>
  </Tooltip>
));

New.story = {
  name: 'new',
};

export const Small = withInfo(
  'A small tag-like thing. Use this when space is at a premium'
)(() => (
  <Tag size="small" border>
    new
  </Tag>
));

Small.story = {
  name: 'small',
};

export const WithIcon = withInfo(
  'A tag-like thing with an icon. Use when you need to represent something'
)(() => <Tag icon="icon-lock">Locked</Tag>);

WithIcon.story = {
  name: 'with icon',
};
