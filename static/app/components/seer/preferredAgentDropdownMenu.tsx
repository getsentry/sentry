import {useQuery} from '@tanstack/react-query';

import {Link} from '@sentry/scraps/link';

import {DropdownMenu, type DropdownMenuProps} from 'sentry/components/dropdownMenu';
import {DropdownMenuFooter} from 'sentry/components/dropdownMenu/footer';
import {t} from 'sentry/locale';
import {seerAgentIntegrationsSelectQueryOptions} from 'sentry/utils/seer/preferredAgent';
import type {AutofixAgentSelectOption} from 'sentry/utils/seer/types';
import {useOrganization} from 'sentry/utils/useOrganization';

export function PreferredAgentDropdownMenu({
  isDisabled,
  size = 'xs',
  onChange,
}: {
  isDisabled: boolean;
  onChange: (value: AutofixAgentSelectOption) => void;
  size?: DropdownMenuProps['size'];
}) {
  const organization = useOrganization();
  const {data: agentOptions = []} = useQuery(
    seerAgentIntegrationsSelectQueryOptions({organization})
  );

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
