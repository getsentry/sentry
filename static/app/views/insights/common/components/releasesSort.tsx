import {CompactSelect} from 'sentry/components/core/compactSelect';
import {ReleasesSortOption} from 'sentry/constants/releases';
import {IconSort} from 'sentry/icons';
import {t} from 'sentry/locale';

export const SORT_BY_OPTIONS = {
  [ReleasesSortOption.SESSIONS_24_HOURS]: {label: t('Active Sessions')},
  [ReleasesSortOption.USERS_24_HOURS]: {label: t('Active Users')},
  [ReleasesSortOption.ADOPTION]: {label: t('Adoption')},
  [ReleasesSortOption.BUILD]: {label: t('Build Number')},
  [ReleasesSortOption.DATE]: {label: t('Date Created')},
  [ReleasesSortOption.SEMVER]: {label: t('Semantic Version')},
  [ReleasesSortOption.SESSIONS]: {label: t('Total Sessions')},
};

export type ReleasesSortByOption = keyof typeof SORT_BY_OPTIONS;

interface Props {
  environments: string[];
  onChange: (sortBy: string) => void;
  sortBy: ReleasesSortByOption;
}

export function ReleasesSort({environments, sortBy, onChange}: Props) {
  return (
    <CompactSelect
      triggerProps={{
        icon: <IconSort />,
        title: t('Sort Releases'),
        'aria-label': t('Sort Releases'),
        children: '',
        showChevron: false,
      }}
      value={sortBy}
      onChange={option => onChange(option.value)}
      options={Object.entries(SORT_BY_OPTIONS).map(([name, filter]) => {
        // Adoption sort requires exactly one environment to be selected
        const isAdoptionSort = name === ReleasesSortOption.ADOPTION;
        const requiresSingleEnvironment = isAdoptionSort && environments.length !== 1;

        return {
          label: filter.label,
          value: name,
          disabled: requiresSingleEnvironment,
          tooltip: requiresSingleEnvironment
            ? t(
                'Adoption sort requires exactly one environment. Please select a single environment to use this option.'
              )
            : undefined,
        };
      })}
    />
  );
}
