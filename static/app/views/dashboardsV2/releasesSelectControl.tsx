import {Fragment} from 'react';

import CompactSelect from 'sentry/components/forms/compactSelect';
import {IconReleases} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useReleases} from 'sentry/utils/releases/releasesProvider';

function ReleasesSelectControl() {
  const triggerIcon = <IconReleases key={0} />;
  const triggerLabel = t('All Releases');

  const {releases, loading} = useReleases();

  return (
    <CompactSelect
      multiple
      isClearable
      isSearchable
      isLoading={loading}
      menuTitle={t('All Releases')}
      options={
        releases.length
          ? releases.map(release => {
              return {label: release.shortVersion, value: release.version};
            })
          : []
      }
      value={undefined}
      triggerLabel={<Fragment>{triggerLabel}</Fragment>}
      triggerProps={{icon: triggerIcon}}
    />
  );
}

export default ReleasesSelectControl;
