import {Avatar} from '@sentry/scraps/avatar';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Flex, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';

import type {OAuthOrganization} from './types';

interface OrganizationConsentCardProps {
  disabled: boolean;
  onChange: (organizationId: string) => void;
  organization: OAuthOrganization;
  organizations: OAuthOrganization[];
}

export function OrganizationConsentCard({
  disabled,
  onChange,
  organization,
  organizations,
}: OrganizationConsentCardProps) {
  return (
    <Flex
      align="center"
      justify="between"
      gap="lg"
      border="secondary"
      radius="md"
      padding="lg"
    >
      <Flex align="center" gap="md" flex="1" minWidth="0">
        <Avatar
          type="letter_avatar"
          identifier={organization.slug}
          name={organization.name}
          size={32}
        />
        <Stack gap="2xs" minWidth="0">
          <Text bold ellipsis>
            {organization.name}
          </Text>
          <Text size="xs" variant="muted" ellipsis>
            {organization.slug}
          </Text>
        </Stack>
      </Flex>
      <CompactSelect
        value={organization.id}
        options={organizations.map(option => ({
          value: option.id,
          label: `${option.name} (${option.slug})`,
          leadingItems: (
            <Avatar
              type="letter_avatar"
              identifier={option.slug}
              name={option.name}
              size={20}
            />
          ),
        }))}
        onChange={option => onChange(option.value)}
        disabled={disabled || organizations.length < 2}
        search
        menuTitle={t('Organization')}
        menuWidth={300}
        position="bottom-end"
        trigger={triggerProps => (
          <OverlayTrigger.Button {...triggerProps} size="xs" variant="transparent">
            {t('Change')}
          </OverlayTrigger.Button>
        )}
      />
    </Flex>
  );
}
