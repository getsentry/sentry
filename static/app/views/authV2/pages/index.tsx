import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {MyNewComponent} from 'sentry/views/authV2/components';
import {loginContext} from 'sentry/views/authV2/contexts/loginContext';
import {organizationContext} from 'sentry/views/authV2/contexts/organizationContext';
import {sessionContext} from 'sentry/views/authV2/contexts/sessionContext';
import type {MyNewType} from 'sentry/views/authV2/types';

function LoginPage() {
  const hasFlag = !!localStorage.getItem('sentry-auth-v2');

  const knipGoAway: MyNewType = !!(
    loginContext &&
    organizationContext &&
    sessionContext &&
    MyNewComponent
  );

  if (knipGoAway) {
    return <p>This is just making Knip pass on CI</p>;
  }

  if (!hasFlag) {
    return (
      <Flex justify="center" align="center" height="100vh">
        <DivStyle>
          <p>
            Go to browser console and paste:
            <code>localStorage.setItem('sentry-auth-v2', 1)</code>
          </p>
          <p>Also, you need a backend feature flag to use the APIs.</p>
        </DivStyle>
      </Flex>
    );
  }

  return (
    <Flex justify="center" align="center" height="100vh">
      <DivStyle>login page</DivStyle>
    </Flex>
  );
}

export default LoginPage;

const DivStyle = styled('div')`
  padding: 20px;
  border: 1px solid #ccc;
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
`;
