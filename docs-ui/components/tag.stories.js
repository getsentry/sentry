import React from 'react';
import styled from '@emotion/styled';
import {select, text} from '@storybook/addon-knobs';

import Tag from 'app/components/tag';
import {IconClock, IconDelete, IconFire, IconIssues, IconWarning} from 'app/icons';
import {toTitleCase} from 'app/utils';
import theme from 'app/utils/theme';

export default {
  title: 'Core/Badges+Tags/Tag',
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
      {text('children', 'Error')}
    </Tag>{' '}
    <Tag icon={<IconWarning />} {...args}>
      {text('children', 'Error')}
    </Tag>{' '}
    <Tag icon={<IconClock />} {...args}>
      {text('children', 'Error')}
    </Tag>{' '}
    <Tag icon={<IconDelete />} {...args}>
      {text('children', 'Error')}
    </Tag>{' '}
    <Tag icon={<IconIssues />} {...args}>
      {text('children', 'Error')}
    </Tag>
  </div>
);
WithIcon.storyName = 'with icon';

export const WithTooltip = () => (
  <Tag type={select('type', types, 'highlight')} tooltipText="lorem ipsum">
    {text('children', 'Tooltip')}
  </Tag>
);
WithTooltip.storyName = 'with tooltip';

export const WithDismiss = ({...args}) => <Tag {...args}>Dismissable</Tag>;
WithDismiss.storyName = 'with dismiss';
WithDismiss.argTypes = {
  onDismiss: {action: 'dismissed'},
};

export const WithInternalLink = () => (
  <Tag to="/organizations/sentry/issues/">{text('children', 'Internal link')}</Tag>
);
WithInternalLink.storyName = 'with internal link';

export const WithExternalLink = () => (
  <Tag href="https://sentry.io/">{text('children', 'External link')}</Tag>
);
WithExternalLink.storyName = 'with external link';

const Wrapper = styled('div')`
  display: grid;
`;
