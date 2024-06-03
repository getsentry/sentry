import {CompactSelect} from 'sentry/components/compactSelect';
import {IconUser} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useOwnerOptions} from 'sentry/utils/useOwnerOptions';
import {useOwners} from 'sentry/utils/useOwners';

interface OwnerFilterProps {
  onChangeFilter: (activeFilters: string[]) => void;
  selectedOwners: string[];
}

const suggestedOptions = [
  {
    label: t('My Teams'),
    value: 'myteams',
  },
  {
    label: t('Unassigned'),
    value: 'unassigned',
  },
];

export function OwnerFilter({selectedOwners, onChangeFilter}: OwnerFilterProps) {
  const {teams, members, fetching, onTeamSearch, onMemberSearch} = useOwners({
    currentValue: selectedOwners,
  });
  const options = useOwnerOptions({
    teams,
    members,
    avatarProps: {size: 18},
  });

  return (
    <CompactSelect
      multiple
      clearable
      searchable
      loading={fetching}
      menuTitle={t('Filter owners')}
      options={[{label: t('Suggested'), options: suggestedOptions}, ...options]}
      value={selectedOwners}
      onSearch={value => {
        onMemberSearch(value);
        onTeamSearch(value);
      }}
      onChange={opts => {
        // Compact select type inference does not work - onChange type is actually T | null.
        if (!opts) {
          return onChangeFilter([]);
        }
        return onChangeFilter(opts.map(opt => opt.value));
      }}
      triggerLabel={!selectedOwners.length ? t('Filter Owners') : undefined}
      triggerProps={{icon: <IconUser />}}
    />
  );
}
