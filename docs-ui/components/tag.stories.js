import React from 'react';
import styled from '@emotion/styled';

import Tag from 'app/components/tag';
import {IconFire} from 'app/icons';

export default {
  title: 'Core/Badges+Tags/Tag',
};

export const Basic = () => (
  <Wrapper>
    <Tag>Default</Tag>
    <Tag type="promotion">Promotion</Tag>
    <Tag type="highlight">Highlight</Tag>
    <Tag type="warning">Warning</Tag>
    <Tag type="success">Success</Tag>
    <Tag type="error">Error</Tag>
    <Tag type="info">Info</Tag>
    <Tag type="white">White</Tag>
  </Wrapper>
);
Basic.story = {name: 'basic'};

export const WithIcon = () => (
  <Tag icon={<IconFire />} type="error">
    Error
  </Tag>
);
WithIcon.story = {name: 'with icon'};

export const WithTooltip = () => (
  <Tag type="highlight" tooltip="lorem ipsum">
    Tooltip
  </Tag>
);
WithTooltip.story = {name: 'with tooltip'};

export const WithDismiss = () => (
  // eslint-disable-next-line no-alert
  <Tag type="highlight" onDismiss={() => alert('dismissed')}>
    Dismissable
  </Tag>
);
WithDismiss.story = {name: 'with dismiss'};

export const WithInternalLink = () => (
  <Tag type="highlight" to="/organizations/sentry/issues/">
    Internal link
  </Tag>
);
WithInternalLink.story = {name: 'with internal link'};

export const WithExternalLink = () => (
  <Tag type="highlight" href="https://sentry.io/">
    External link
  </Tag>
);
WithExternalLink.story = {name: 'with external link'};

const Wrapper = styled('div')`
  display: grid;
`;
