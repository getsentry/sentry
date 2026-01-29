import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import {RELEASES_SORT_OPTIONS, ReleasesSortOption} from 'sentry/constants/releases';
import {IconSort} from 'sentry/icons';
import {t} from 'sentry/locale';
import usePageFilters from 'sentry/utils/usePageFilters';

interface ReleasesSortSelectProps {
  onChange: (sortBy: ReleasesSortOption) => void;
  sortBy: ReleasesSortOption;
  disabled?: boolean;
}

export function ReleasesSortSelect({
  sortBy,
  onChange,
  disabled,
}: ReleasesSortSelectProps) {
  const {selection} = usePageFilters();
  const {environments} = selection;
  return (
    <CompactSelect
      disabled={disabled}
      value={sortBy}
      onChange={option => {
        onChange(option.value);
      }}
      options={(
        Object.keys(RELEASES_SORT_OPTIONS) as Array<keyof typeof RELEASES_SORT_OPTIONS>
      ).map(name => {
        const filter = RELEASES_SORT_OPTIONS[name];
        if (name !== ReleasesSortOption.ADOPTION) {
          return {
            label: filter,
            value: name,
          };
        }

        // Adoption sort requires exactly one environment because it calculates
        // the percentage of sessions/users in that specific environment
        const isNotSingleEnvironment = environments.length !== 1;
        return {
          label: filter,
          value: name,
          disabled: isNotSingleEnvironment,
          tooltip: isNotSingleEnvironment
            ? t('Select one environment to use this sort option.')
            : undefined,
        };
      })}
      trigger={triggerProps => (
        <OverlayTrigger.IconButton
          {...triggerProps}
          icon={<IconSort variant="muted" />}
          aria-label={t('Sort Releases')}
        />
      )}
    />
  );
}
