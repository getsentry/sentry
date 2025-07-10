import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

const HERO_IMAGE_URL =
  'data:image/webp;base64,UklGRhIAAABXRUJQVlA4TAYAAAAvAAAAEAcAASxYAAEAAQAcJaQAA3AA/vuUAAA=';

function LoginPage() {
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const email = formData.get('email');
    const password = formData.get('password');

    try {
      const response = await fetch('/api/0/auth-v2/login/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({email, password}),
      });

      if (!response.ok) {
        throw new Error('Login failed');
      }

      await response.json();
    } catch (error) {
      // Handle error in UI (to be implemented)
    }
  };

  const handleGetCsrfToken = async () => {
    try {
      const response = await fetch('/api/0/auth-v2/csrf/', {
        method: 'GET',
      });

      const lol = await response.json();
      console.log(lol);
    } catch (error) {
      console.log(error);
    }
  };
  const handleGetHw = async () => {
    try {
      const response = await fetch('/api/0/auth-v2/login/', {
        method: 'GET',
      });

      const lol = await response.json();
      console.log(lol);
    } catch (error) {
      console.log(error);
    }
  };

  const handleRotateCsrfToken = async () => {
    try {
      const response = await fetch('/api/0/auth-v2/csrf/', {
        method: 'PUT',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to rotate CSRF token');
      }

      const lol = await response.json();
      console.log(lol);
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <Page>
      <LeftColumn>
        <img src={HERO_IMAGE_URL} alt="Sentry Logo" />
      </LeftColumn>
      <RightColumn>
        <RegisterPrompt />
        <SignInForm>
          <h2>Sign In</h2>
          <form onSubmit={handleSubmit}>
            <Input
              name="email"
              type="email"
              placeholder="Email"
              value="dlee@sentry.io"
              required
            />
            <Input name="password" type="password" placeholder="Password" required />
            <Button type="submit">Sign In</Button>
          </form>
        </SignInForm>

        <CsrfButtonGroup>
          <SecondaryButton onClick={handleGetCsrfToken}>Get CSRF Token</SecondaryButton>
          <SecondaryButton onClick={handleRotateCsrfToken}>
            Rotate CSRF Token
          </SecondaryButton>
          <SecondaryButton onClick={handleGetHw}>Get HW</SecondaryButton>
        </CsrfButtonGroup>
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

const CsrfButtonGroup = styled('div')`
  display: flex;
  gap: ${space(1)};
  margin-top: ${space(2)};
`;

const SecondaryButton = styled('button')`
  padding: 10px;
  background-color: transparent;
  color: ${p => p.theme.gray300};
  border: 1px solid ${p => p.theme.gray200};
  border-radius: 4px;
  cursor: pointer;
  &:hover {
    background-color: ${p => p.theme.gray100};
  }
`;

export default LoginPage;
