import React from 'react';
import styled from '@emotion/styled';
import PlatformIcon from 'platformicons';
import {withInfo} from '@storybook/addon-info';

const StyledPlatformIcon = styled(PlatformIcon)`
  margin: 0 15px 15px 0;
`;

export default {
  title: 'Core/Style/Icons',
};

export const _PlatformIcon = withInfo('Scalable platform and framework icons')(() => (
  <div>
    <StyledPlatformIcon platform="generic" size="24" />
    <StyledPlatformIcon platform="javascript-angular" size="24" />
    <StyledPlatformIcon platform="java-appengine" size="24" />
    <StyledPlatformIcon platform="apple" size="24" />
    <StyledPlatformIcon platform="python-bottle" size="24" />
    <StyledPlatformIcon platform="cordova" size="24" />
    <StyledPlatformIcon platform="csharp" size="24" />
    <StyledPlatformIcon platform="python-django" size="24" />
    <StyledPlatformIcon platform="electron" size="24" />
    <StyledPlatformIcon platform="elixir" size="24" />
    <StyledPlatformIcon platform="javascript-ember" size="24" />
    <StyledPlatformIcon platform="python-flask" size="24" />
    <StyledPlatformIcon platform="go" size="24" />
    <StyledPlatformIcon platform="java" size="24" />
    <StyledPlatformIcon platform="node" size="24" />
    <StyledPlatformIcon platform="php" size="24" />
    <StyledPlatformIcon platform="perl" size="24" />
    <StyledPlatformIcon platform="python" size="24" />
    <StyledPlatformIcon platform="ruby-rails" size="24" />
    <StyledPlatformIcon platform="javascript-react" size="24" />
    <StyledPlatformIcon platform="ruby" size="24" />
    <StyledPlatformIcon platform="rust" size="24" />
    <StyledPlatformIcon platform="swift" size="24" />
    <StyledPlatformIcon platform="javascript-vue" size="24" />
  </div>
));

_PlatformIcon.story = {
  name: 'PlatformIcon',
};
