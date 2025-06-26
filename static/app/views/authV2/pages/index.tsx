import styled from '@emotion/styled';

function LoginPage() {
  const hasFlag = !!localStorage.getItem('sentry-auth-v2');

  if (!hasFlag) {
    return (
      <PageStyle>
        <DivStyle>
          <p>
            Go to browser console and paste:
            <code>localStorage.setItem('sentry-auth-v2', 1)</code>
          </p>
          <p>Also, you need a backend feature flag to use the APIs.</p>
        </DivStyle>
      </PageStyle>
    );
  }

  return (
    <PageStyle>
      <DivStyle>login page</DivStyle>
    </PageStyle>
  );
}

export default LoginPage;

const PageStyle = styled('div')`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
`;

const DivStyle = styled('div')`
  padding: 20px;
  border: 1px solid #ccc;
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
`;
