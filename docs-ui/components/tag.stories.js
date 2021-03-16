import React from 'react';
import styled from '@emotion/styled';

import Tag from 'app/components/tag';
import {IconClock, IconDelete, IconFire, IconIssues, IconWarning} from 'app/icons';
import {toTitleCase} from 'app/utils';
import theme from 'app/utils/theme';

export default {
  title: 'Core/Tags/Tag',
  component: Tag,
  argTypes: {
    tooltipText: {
      type: 'string',
    },
    to: {
      table: {
        disable: true,
      },
    },
    icon: {
      table: {
        disable: true,
      },
    },
    onDismiss: {
      table: {
        disable: true,
      },
    },
    href: {
      table: {
        disable: true,
      },
    },
  },
};

const types = Object.keys(theme.tag);

export const Basic = () => (
  <Wrapper>
    {types.map(type => (
      <Tag key={type} type={type}>
        {toTitleCase(type)}
      </Tag>
    ))}
  </Wrapper>
);
Basic.storyName = 'basic';

export const WithIcon = ({...args}) => (
  <div>
    <Tag icon={<IconFire />} {...args}>
      Error
    </Tag>{' '}
    <Tag icon={<IconWarning />} {...args}>
      Error
    </Tag>{' '}
    <Tag icon={<IconClock />} {...args}>
      Error
    </Tag>{' '}
    <Tag icon={<IconDelete />} {...args}>
      Error
    </Tag>{' '}
    <Tag icon={<IconIssues />} {...args}>
      Error
    </Tag>
  </div>
);
WithIcon.storyName = 'with icon';

export const WithTooltip = ({type}) => (
  <Tag type={type} tooltipText="lorem ipsum">
    children
  </Tag>
);
WithTooltip.storyName = 'with tooltip';
WithTooltip.args = {
  type: 'highlight',
};
WithTooltip.argTypes = {
  type: {
    control: {
      type: 'select',
      options: types,
    },
  },
};

export const WithDismiss = ({...args}) => <Tag {...args}>Dismissable</Tag>;
WithDismiss.storyName = 'with dismiss';
WithDismiss.argTypes = {
  onDismiss: {action: 'dismissed'},
};

export const WithInternalLink = () => (
  <Tag to="/organizations/sentry/issues/">Internal link</Tag>
);
WithInternalLink.storyName = 'with internal link';

export const WithExternalLink = () => <Tag href="https://sentry.io/">External link</Tag>;
WithExternalLink.storyName = 'with external link';

const Wrapper = styled('div')`
  display: grid;
`;
