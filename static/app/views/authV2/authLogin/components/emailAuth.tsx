import {useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {InputGroup} from '@sentry/scraps/input';
import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IconArrow, IconHide, IconShow} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {
  useEmailAuth,
  type EmailAuthResult,
} from 'sentry/views/authV2/authLogin/hooks/useEmailAuth';
import {usePasswordReset} from 'sentry/views/authV2/authLogin/hooks/usePasswordReset';

interface EmailAuthProps {
  onAuthResult: (result: EmailAuthResult) => void;
  /**
   * A hint for the post-authentication destination. Organization SSO requirements
   * may send the user elsewhere.
   */
  organizationSlug?: string;
}

export function EmailAuth({onAuthResult, organizationSlug}: EmailAuthProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const emailAuth = useEmailAuth(organizationSlug);
  const passwordReset = usePasswordReset();
  const passwordVisibilityLabel = isPasswordVisible
    ? t('Hide password')
    : t('Show password');
  const authError = emailAuth.errorMessage;
  const errorMessage = passwordReset.errorMessage ?? authError;
  const isPending = emailAuth.isPending || passwordReset.isPending;

  function handleEmailChange(event: React.ChangeEvent<HTMLInputElement>) {
    setEmail(event.currentTarget.value);
    emailAuth.reset();
    passwordReset.reset();
  }

  function handlePasswordChange(event: React.ChangeEvent<HTMLInputElement>) {
    setPassword(event.currentTarget.value);
    emailAuth.reset();
  }

  function setPasswordRecoveryMode(enabled: boolean) {
    emailAuth.reset();
    passwordReset.reset();
    setIsPasswordRecovery(enabled);
  }

  useEffect(() => {
    if (emailAuth.result) {
      onAuthResult(emailAuth.result);
    }
  }, [emailAuth.result, onAuthResult]);

  return (
    <form
      onSubmit={event => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const submittedEmail = formData.get('email');
        const submittedPassword = formData.get('password');

        if (typeof submittedEmail !== 'string') {
          return;
        }

        setEmail(submittedEmail);

        if (isPasswordRecovery) {
          setRecoveryEmail(submittedEmail);
          passwordReset.requestPasswordReset(submittedEmail);
        } else if (typeof submittedPassword === 'string') {
          setPassword(submittedPassword);
          emailAuth.authenticate({
            email: submittedEmail,
            password: submittedPassword,
          });
        }
      }}
    >
      <Container>
        {errorMessage && (
          <Container paddingBottom="md">
            <Alert.Container>
              <Alert role="alert" variant="danger" showIcon={false}>
                {errorMessage}
              </Alert>
            </Alert.Container>
          </Container>
        )}
        {passwordReset.result ? (
          <Alert role="status" variant="muted" showIcon={false}>
            {tct(
              'A recovery link has been sent to [email] (only if there is a Sentry account for that email!).',
              {
                email: (
                  <Text as="span" bold>
                    {recoveryEmail}
                  </Text>
                ),
              }
            )}
          </Alert>
        ) : (
          <InputGroup>
            <InputGroup.Input
              type="email"
              name="email"
              value={email}
              autoComplete="email"
              disabled={isPending}
              placeholder={
                isPasswordRecovery ? t('Email of account to recover') : t('Email')
              }
              aria-label={t('Email')}
              aria-invalid={Boolean(errorMessage)}
              required
              onChange={handleEmailChange}
            />
          </InputGroup>
        )}
        {!isPasswordRecovery && (
          <Container paddingTop="md">
            <InputGroup>
              <InputGroup.Input
                type={isPasswordVisible ? 'text' : 'password'}
                name="password"
                value={password}
                autoComplete="current-password"
                disabled={isPending}
                placeholder={t('Password')}
                aria-label={t('Password')}
                aria-invalid={Boolean(authError)}
                required
                onChange={handlePasswordChange}
              />
              <InputGroup.TrailingItems>
                {password && (
                  <Button
                    aria-label={passwordVisibilityLabel}
                    icon={isPasswordVisible ? <IconHide /> : <IconShow />}
                    size="zero"
                    tooltipProps={{title: passwordVisibilityLabel}}
                    variant="transparent"
                    onClick={() => setIsPasswordVisible(visible => !visible)}
                  />
                )}
              </InputGroup.TrailingItems>
            </InputGroup>
          </Container>
        )}
        <Flex paddingTop="md">
          <Container flex="1" paddingTop="sm">
            {!passwordReset.result && !isPasswordRecovery && (
              <Button
                type="submit"
                variant="primary"
                size="sm"
                busy={emailAuth.isPending}
              >
                {t('Log in to Sentry')}
              </Button>
            )}
            {!passwordReset.result && isPasswordRecovery && (
              <Button
                type="submit"
                variant="primary"
                size="sm"
                busy={passwordReset.isPending}
              >
                {t('Reset Password')}
              </Button>
            )}
          </Container>
          <Flex flex="1" justify="end">
            {isPasswordRecovery ? (
              <ForgotPasswordButton
                disabled={isPending}
                variant="transparent"
                size="xs"
                icon={<IconArrow direction="left" />}
                onClick={() => setPasswordRecoveryMode(false)}
              >
                {t('Back to Login')}
              </ForgotPasswordButton>
            ) : (
              <ForgotPasswordButton
                disabled={isPending}
                variant="transparent"
                size="xs"
                onClick={() => setPasswordRecoveryMode(true)}
              >
                {t('Forgot password?')}
              </ForgotPasswordButton>
            )}
          </Flex>
        </Flex>
      </Container>
    </form>
  );
}

const ForgotPasswordButton = styled(Button)`
  color: ${p => p.theme.tokens.content.secondary};
  font-weight: ${p => p.theme.font.weight.sans.regular};
`;
