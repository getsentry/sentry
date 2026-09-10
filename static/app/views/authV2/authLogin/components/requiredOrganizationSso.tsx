import {Button} from '@sentry/scraps/button';
import {InfoTip} from '@sentry/scraps/info';
import {Container, Flex, Stack} from '@sentry/scraps/layout';

import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {AuthOrganization} from 'sentry/views/authV2/authLogin/hooks/useAuthOrganization';

import {OrganizationAuth} from './organizationAuth';

interface RequiredOrganizationSsoProps {
  authOrganization: AuthOrganization;
  onClear: () => void;
}

export function RequiredOrganizationSso({
  authOrganization,
  onClear,
}: RequiredOrganizationSsoProps) {
  return (
    <Stack align="center" gap="md">
      <Container width="100%">
        <OrganizationAuth
          authOrganization={authOrganization}
          hideClearButton
          onClear={onClear}
        />
      </Container>
      <Flex width="100%" align="center" justify="between">
        <Button
          icon={<IconArrow direction="left" />}
          size="zero"
          variant="transparent"
          onClick={onClear}
        >
          {t('Wrong organization')}
        </Button>
        <InfoTip
          position="bottom"
          variant="muted"
          size="xs"
          title={t(
            'This organization requires SSO authentication. You may still log in with an email and password to access other organizations and account settings.'
          )}
        />
      </Flex>
    </Stack>
  );
}
