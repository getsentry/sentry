import React from 'react';
import styled from '@emotion/styled';

import {IconSentry} from 'app/icons';
import PluginIcon from 'app/plugins/components/pluginIcon';

export default function IconGroup({pluginId}: {pluginId: string}) {
  return (
    <IconWrapper>
      <StyledPluginIcon size={32} pluginId={pluginId} />
      <StyledIconSentry size="xl" />
    </IconWrapper>
  );
}

const IconWrapper = styled('div')`
  text-align: center;
`;

const StyledIconSentry = styled(IconSentry)`
  margin-left: 15px;
`;

const StyledPluginIcon = styled(PluginIcon)`
  top: 2px;
`;
