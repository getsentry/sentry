import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

const HERO_IMAGE_URL =
  'data:image/webp;base64,UklGRhIAAABXRUJQVlA4TAYAAAAvAAAAEAcAASxYAAEAAQAcJaQAA3AA/vuUAAA=';

function LoginPage() {
  return (
    <Page>
      <LeftColumn>
        <img src={HERO_IMAGE_URL} alt="Sentry Logo" />
      </LeftColumn>
      <RightColumn>
        <RegisterPrompt />
        <SignInForm>
          <h2>Sign In</h2>
          <form>
            <Input type="email" placeholder="Email" required />
            <Button type="submit">Sign In</Button>
          </form>
        </SignInForm>
      </RightColumn>
    </Page>
  );
}

function RegisterPrompt() {
  return (
    <PromptWrapper>
      <div>New to Sentry?</div>
      <div>
        <a href="">Register here</a>
      </div>
    </PromptWrapper>
  );
}

const Page = styled('div')`
  display: flex;
  flex-direction: row;
  height: 100vh;

  @media (max-width: ${p => p.theme.breakpoints.md}) {
    flex-direction: column;
  }
`;

const LeftColumn = styled('div')`
  flex: 1;
  background-color: #e0e0e0;

  @media (max-width: 768px) {
    display: none;
  }

  > img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
  }
`;

const RightColumn = styled('div')`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
`;

const SignInForm = styled('div')`
  width: 100%;
  max-width: 400px;
  text-align: center;
`;

const Input = styled('input')`
  width: 100%;
  padding: 10px;
  margin: 10px 0;
  border: 1px solid #ccc;
  border-radius: 4px;
`;

const Button = styled('button')`
  width: 100%;
  padding: 10px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  &:hover {
    background-color: #0056b3;
  }
`;

const PromptWrapper = styled('div')`
  position: absolute;
  top: ${space(2)};
  right: ${space(2)};
  text-align: right;
`;

export default LoginPage;
