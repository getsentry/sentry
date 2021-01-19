import React from 'react';
import styled from '@emotion/styled';

import {IconSentry} from 'app/icons';
import PluginIcon from 'app/plugins/components/pluginIcon';

export default function IconGroup({pluginId}: {pluginId: string}) {
  return (
    <IconWrapper>
      <StyledPluginIcon size={50} pluginId={pluginId} />
      <StyledIconSentry />
    </IconWrapper>
  );
}

const IconWrapper = styled('div')`
  text-align: center;
`;

const StyledIconSentry = styled(IconSentry)`
  width: 50px;
  height: 50px;
  margin-left: 40px;
`;

const StyledPluginIcon = styled(PluginIcon)`
  top: 4px;
`;
