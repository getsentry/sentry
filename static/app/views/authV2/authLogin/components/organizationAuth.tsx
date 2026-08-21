import styled from '@emotion/styled';

import {Avatar} from '@sentry/scraps/avatar';
import {Button, LinkButton} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IconClose, IconMegaphone} from 'sentry/icons';
import {IdentityIcon} from 'sentry/icons/identityIcon';
import {t, tct} from 'sentry/locale';
import {getCsrfToken} from 'sentry/utils/getCsrfToken';
import type {AuthOrganization} from 'sentry/views/authV2/authLogin/hooks/useAuthOrganization';

interface OrganizationAuthProps {
  authOrganization: AuthOrganization;
  onClear?: () => void;
}

export function OrganizationAuth({authOrganization, onClear}: OrganizationAuthProps) {
  const {organization, provider, joinRequestUrl, ssoRequired} = authOrganization;
  const avatarProps = organization.avatarUrl
    ? ({
        type: 'upload',
        uploadUrl: organization.avatarUrl,
        identifier: organization.slug,
        name: organization.name,
      } as const)
    : ({
        type: 'letter_avatar',
        identifier: organization.slug,
        name: organization.name,
      } as const);
  const description = provider
    ? ssoRequired
      ? tct('[requires:Requires] sign in with [icon] [provider]', {
          requires: (
            <Text as="span" bold>
              {null}
            </Text>
          ),
          icon: (
            <IdentityIcon
              providerId={provider.key}
              size={12}
              display="inline-flex"
              noBackground
            />
          ),
          provider: provider.name,
        })
      : tct('Members sign in with [icon] [provider]', {
          icon: (
            <IdentityIcon
              providerId={provider.key}
              size={12}
              display="inline-flex"
              noBackground
            />
          ),
          provider: provider.name,
        })
    : t('Members sign in with email and password');

  return (
    <OrganizationCardContainer position="relative">
      <Stack gap="0" border="secondary" radius="md" overflow="hidden">
        <Flex align="center" gap="lg" padding="lg">
          <Flex align="center" gap="md" flex="1" minWidth="0">
            <Avatar {...avatarProps} size={32} />
            <Stack gap="2xs" flex="1" minWidth="0">
              <Text bold ellipsis>
                {organization.name}
              </Text>
              <Text size="xs" variant="muted">
                {description}
              </Text>
            </Stack>
          </Flex>
          <form method="POST">
            <input type="hidden" name="csrfmiddlewaretoken" value={getCsrfToken()} />
            <input type="hidden" name="init" value="1" />
            <Button
              disabled={!provider}
              type="submit"
              variant={provider ? 'primary' : undefined}
              tooltipProps={{
                title: provider
                  ? undefined
                  : t('This organization does not have Single Sign-On configured'),
              }}
            >
              {t('SSO')}
            </Button>
          </form>
        </Flex>

        {joinRequestUrl && (
          <Flex
            align="center"
            justify="between"
            gap="lg"
            borderTop="secondary"
            padding="sm lg"
          >
            <Text size="sm">{t('Not a member?')}</Text>
            <LinkButton
              href={joinRequestUrl}
              icon={<IconMegaphone />}
              size="xs"
              variant="transparent"
            >
              {t('Request to join')}
            </LinkButton>
          </Flex>
        )}
      </Stack>
      {onClear && (
        <ClearButton
          aria-label={t('Clear organization login context')}
          icon={<IconClose />}
          size="zero"
          tooltipProps={{title: t('Clear organization login context')}}
          variant="transparent"
          onClick={onClear}
        />
      )}
    </OrganizationCardContainer>
  );
}

const ClearButton = styled(Button)`
  position: absolute;
  top: calc(${p => p.theme.space.lg} + 18px);
  left: calc(100% + ${p => p.theme.space.md});
  translate: 0 -50%;
  opacity: 0;
  pointer-events: none;
  transition: opacity 100ms ease;

  @media (hover: none) {
    opacity: 1;
    pointer-events: auto;
  }
`;

const OrganizationCardContainer = styled(Container)`
  &::before {
    content: '';
    position: absolute;
    inset-block: 0;
    left: 100%;
    width: 42px;
  }

  &:hover ${ClearButton},
  &:focus-within ${ClearButton} {
    opacity: 1;
    pointer-events: auto;
  }
`;
