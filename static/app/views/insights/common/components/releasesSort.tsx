import {Button} from 'sentry/components/button';
import {CompositeSelect} from 'sentry/components/compactSelect/composite';
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
    <CompositeSelect
      trigger={triggerProps => (
        <Button
          {...triggerProps}
          size="xs"
          icon={<IconSort />}
          title={t('Sort Releases')}
          aria-label={t('Sort Releases')}
        />
      )}
    >
      <CompositeSelect.Region
        label={t('Sort By')}
        value={sortBy}
        onChange={selection => {
          onChange(selection.value);
        }}
        options={Object.entries(SORT_BY_OPTIONS).map(([name, filter]) => {
          if (name !== ReleasesSortOption.ADOPTION) {
            return {
              label: filter.label,
              value: name,
            };
          }

          const isNotSingleEnvironment = environments.length !== 1;
          return {
            label: filter.label,
            value: name,
            disabled: isNotSingleEnvironment,
            tooltip: isNotSingleEnvironment
              ? t('Select one environment to use this sort option.')
              : undefined,
          };
        })}
      />
    </CompositeSelect>
  );
}
