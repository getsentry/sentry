import {useQuery} from '@tanstack/react-query';

import {DropdownMenu} from '@sentry/scraps/dropdownMenu';
import {DropdownMenuFooter} from '@sentry/scraps/dropdownMenu';
import {Link} from '@sentry/scraps/link';

import {t} from 'sentry/locale';
import {seerAgentIntegrationsSelectQueryOptions} from 'sentry/utils/seer/preferredAgent';
import type {AutofixAgentSelectOption} from 'sentry/utils/seer/types';
import {useOrganization} from 'sentry/utils/useOrganization';

export function PreferredAgentDropdownMenu({
  isDisabled,
  onChange,
}: {
  isDisabled: boolean;
  onChange: (value: AutofixAgentSelectOption) => void;
}) {
  const organization = useOrganization();
  const {data: agentOptions = []} = useQuery(
    seerAgentIntegrationsSelectQueryOptions({organization})
  );

  return (
    <DropdownMenu
      isDisabled={isDisabled}
      size="xs"
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
