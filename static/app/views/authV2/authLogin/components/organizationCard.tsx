import type {ReactNode} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {IconClose} from '@sentry/icons/close';

import {Avatar} from '@sentry/scraps/avatar';
import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IdentityIcon} from 'sentry/icons/identityIcon';
import {t, tct} from 'sentry/locale';
import {useMedia} from 'sentry/utils/useMedia';
import type {AuthOrganization} from 'sentry/views/authV2/authLogin/hooks/useAuthOrganization';

interface OrganizationCardProps {
  authOrganization: AuthOrganization;
  action?: ReactNode;
  footer?: ReactNode;
  onClear?: () => void;
}

export function OrganizationCard({
  action,
  authOrganization,
  footer,
  onClear,
}: OrganizationCardProps) {
  const theme = useTheme();
  const isSmallScreen = useMedia(`(max-width: ${theme.breakpoints.sm})`);
  const {organization, provider} = authOrganization;
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
    ? tct('Members sign in with [icon] [provider]', {
        icon: <InlineIdentityIcon providerId={provider.key} />,
        provider: provider.name,
      })
    : t('Members sign in with email and password');

  return (
    <Stack align="start" gap="md">
      <OrganizationCardStack
        width="100%"
        gap="0"
        border="secondary"
        radius="md"
        position="relative"
      >
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
          {action}
        </Flex>

        {footer}
        {onClear && !isSmallScreen && (
          <ClearButton
            aria-label={t('Clear organization login context')}
            icon={<IconClose />}
            size="zero"
            tooltipProps={{title: t('Clear organization login context')}}
            variant="transparent"
            onClick={onClear}
          />
        )}
      </OrganizationCardStack>
      {onClear && isSmallScreen && (
        <Button icon={<IconClose />} size="zero" variant="transparent" onClick={onClear}>
          {t('Wrong Organization')}
        </Button>
      )}
    </Stack>
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

const InlineIdentityIcon = styled(IdentityIcon)`
  display: inline-flex;
  width: 12px;
  height: 12px;
  vertical-align: text-bottom;
  background: transparent;

  > div {
    width: 100%;
    height: 100%;
  }
`;

const OrganizationCardStack = styled(Stack)`
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
