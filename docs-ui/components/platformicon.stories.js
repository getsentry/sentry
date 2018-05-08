import React from 'react';
import styled from 'react-emotion';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import Platformicon from 'app/components/platformicon';

const StyledPlatformicon = styled(Platformicon)`
  margin: 0 15px 15px 0;
`;

storiesOf('Platformicon', module).add(
  'default',
  withInfo('Scalable platform and framework icons')(() => (
    <div>
      <StyledPlatformicon platform="generic" size="24" />
      <StyledPlatformicon platform="javascript-angular" size="24" />
      <StyledPlatformicon platform="java-appengine" size="24" />
      <StyledPlatformicon platform="apple" size="24" />
      <StyledPlatformicon platform="python-bottle" size="24" />
      <StyledPlatformicon platform="cordova" size="24" />
      <StyledPlatformicon platform="csharp" size="24" />
      <StyledPlatformicon platform="python-django" size="24" />
      <StyledPlatformicon platform="electron" size="24" />
      <StyledPlatformicon platform="elixir" size="24" />
      <StyledPlatformicon platform="javascript-ember" size="24" />
      <StyledPlatformicon platform="python-flask" size="24" />
      <StyledPlatformicon platform="go" size="24" />
      <StyledPlatformicon platform="java" size="24" />
      <StyledPlatformicon platform="node" size="24" />
      <StyledPlatformicon platform="php" size="24" />
      <StyledPlatformicon platform="perl" size="24" />
      <StyledPlatformicon platform="python" size="24" />
      <StyledPlatformicon platform="ruby-rails" size="24" />
      <StyledPlatformicon platform="javascript-react" size="24" />
      <StyledPlatformicon platform="ruby" size="24" />
      <StyledPlatformicon platform="rust" size="24" />
      <StyledPlatformicon platform="swift" size="24" />
      <StyledPlatformicon platform="javascript-vue" size="24" />
    </div>
  ))
);
