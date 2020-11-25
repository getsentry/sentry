import React from 'react';
import styled from '@emotion/styled';
import {select, text} from '@storybook/addon-knobs';

import Tag from 'app/components/tag';
import Tooltip from 'app/components/tooltip';
import {IconClock, IconDelete, IconFire, IconIssues, IconWarning} from 'app/icons';
import {toTitleCase} from 'app/utils';
import theme from 'app/utils/theme';

export default {
  title: 'Core/Badges+Tags/Tag',
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
Basic.story = {name: 'basic'};

export const WithIcon = () => (
  <div>
    <Tag icon={<IconFire />} type={select('type', types, 'default')}>
      {text('children', 'Error')}
    </Tag>{' '}
    <Tag icon={<IconWarning />} type={select('type', types, 'default')}>
      {text('children', 'Error')}
    </Tag>{' '}
    <Tag icon={<IconClock />} type={select('type', types, 'default')}>
      {text('children', 'Error')}
    </Tag>{' '}
    <Tag icon={<IconDelete />} type={select('type', types, 'default')}>
      {text('children', 'Error')}
    </Tag>{' '}
    <Tag icon={<IconIssues />} type={select('type', types, 'default')}>
      {text('children', 'Error')}
    </Tag>
  </div>
);
WithIcon.story = {name: 'with icon'};

export const WithTooltip = () => (
  <Tooltip title="This is some tooltip text" containerDisplayMode="inline">
    <Tag type={select('type', types, 'highlight')}>{text('children', 'Tooltip')}</Tag>
  </Tooltip>
);
WithTooltip.story = {name: 'with tooltip'};

export const WithDismiss = () => (
  // eslint-disable-next-line no-alert
  <Tag type={select('type', types, 'highlight')} onDismiss={() => alert('dismissed')}>
    {text('children', 'Dismissable')}
  </Tag>
);
WithDismiss.story = {name: 'with dismiss'};

export const WithInternalLink = () => (
  <Tag type={select('type', types, 'highlight')} to="/organizations/sentry/issues/">
    {text('children', 'Internal link')}
  </Tag>
);
WithInternalLink.story = {name: 'with internal link'};

export const WithExternalLink = () => (
  <Tag type={select('type', types, 'highlight')} href="https://sentry.io/">
    {text('children', 'External link')}
  </Tag>
);
WithExternalLink.story = {name: 'with external link'};

const Wrapper = styled('div')`
  display: grid;
`;
