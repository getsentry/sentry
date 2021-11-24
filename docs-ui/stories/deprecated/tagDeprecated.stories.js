import {Fragment} from 'react';

import Tag from 'sentry/components/tagDeprecated';
import Tooltip from 'sentry/components/tooltip';

export default {
  title: 'Deprecated/TagDeprecated',
};

export const Overview = () => (
  <Fragment>
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
  </Fragment>
);

export const Default = () => <Tag>Development</Tag>;

Default.storyName = 'default';
Default.parameters = {
  docs: {
    description: {
      story: 'A basic tag-like thing. If you pass no type, it will be gray',
    },
  },
};

export const Warning = () => <Tag priority="warning">Development</Tag>;

Warning.storyName = 'warning';
Warning.parameters = {
  docs: {
    description: {
      story:
        'A warning tag-like thing. Use this to signal that something is maybe not so great',
    },
  },
};

export const Success = () => <Tag priority="success">Development</Tag>;

Success.storyName = 'success';
Success.parameters = {
  docs: {
    description: {
      story: 'A happy tag-like thing. Use this to signal something good',
    },
  },
};

export const Beta = () => (
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
);

Beta.storyName = 'beta';
Beta.parameters = {
  docs: {
    description: {
      story:
        'An attention grabbing thing. Use this to communicate shiny new functionality.',
    },
  },
};

export const New = () => (
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
);

New.storyName = 'new';
New.parameters = {
  docs: {
    description: {
      story:
        'An attention grabbing thing. Use this to communicate shiny new functionality.',
    },
  },
};

export const Small = () => (
  <Tag size="small" border>
    new
  </Tag>
);

Small.storyName = 'small';
Small.parameters = {
  docs: {
    description: {
      story: 'A small tag-like thing. Use this when space is at a premium',
    },
  },
};

export const WithIcon = () => <Tag icon="icon-lock">Locked</Tag>;

WithIcon.storyName = 'with icon';
WithIcon.parameters = {
  docs: {
    description: {
      story: 'A tag-like thing with an icon. Use when you need to represent something',
    },
  },
};
