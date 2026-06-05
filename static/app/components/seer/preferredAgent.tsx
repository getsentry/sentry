import {Fragment} from 'react';

import {Link} from '@sentry/scraps/link';

import {DropdownMenu, type DropdownMenuProps} from 'sentry/components/dropdownMenu';
import {DropdownMenuFooter} from 'sentry/components/dropdownMenu/footer';
import {t} from 'sentry/locale';
import {
  useSeerAgentSelectOptions,
  useKnownAgents,
} from 'sentry/utils/seer/preferredAgent';
import type {SeerAgent, SeerProjectSettingResponse} from 'sentry/utils/seer/types';
import {useOrganization} from 'sentry/utils/useOrganization';

/**
 * Render a known agent to their human-readable names.
 *
 * If the integrationId is not found, return the agent name and the integrationId as a fallback.
 */
export function PreferredAgentLabel({settings}: {settings: SeerProjectSettingResponse}) {
  const integrations = useKnownAgents();
  return (
    <Fragment>
      {settings.agent === 'seer'
        ? t('Seer Agent')
        : (integrations.find(i => i.id === settings.integrationId)?.name ??
          `${settings.agent} - ${settings.integrationId}`)}
    </Fragment>
  );
}

export function PreferredAgentDropdownMenu({
  isDisabled,
  size = 'xs',
  onChange,
}: {
  isDisabled: boolean;
  onChange: (value: SeerAgent) => void;
  size?: DropdownMenuProps['size'];
}) {
  const organization = useOrganization();
  const agentOptions = useSeerAgentSelectOptions();

  return (
    <DropdownMenu
      isDisabled={isDisabled}
      size={size}
      triggerLabel={t('Agent')}
      items={
        agentOptions.map(({value, label}) => ({
          key: value,
          label,
          onAction: () => onChange(value),
        })) ?? []
      }
      menuFooter={
        <DropdownMenuFooter>
          <Link
            to={{
              pathname: `/settings/${organization.slug}/integrations/`,
              query: {category: 'coding agent'},
            }}
          >
            {t('Manage Coding Agents')}
          </Link>
        </DropdownMenuFooter>
      }
    />
  );
}
