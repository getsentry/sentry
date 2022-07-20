import {useState} from 'react';
import styled from '@emotion/styled';

import Badge from 'sentry/components/badge';
import CompactSelect from 'sentry/components/forms/compactSelect';
import TextOverflow from 'sentry/components/textOverflow';
import {IconReleases} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Release} from 'sentry/types';
import {useReleases} from 'sentry/utils/releases/releasesProvider';

type Props = {
  className?: string;
  isDisabled?: boolean;
};

function ReleasesSelectControl({className, isDisabled}: Props) {
  const {releases, loading} = useReleases();
  const [selectedReleases, setSelectedReleases] = useState<Release[]>([]);

  const triggerLabel = selectedReleases.length ? (
    <TextOverflow>{selectedReleases[0]} </TextOverflow>
  ) : (
    t('All Releases')
  );

  return (
    <CompactSelect
      multiple
      isClearable
      isSearchable
      isDisabled={isDisabled}
      isLoading={loading}
      menuTitle={t('Filter Releases')}
      className={className}
      options={
        releases.length
          ? releases.map(release => {
              return {
                label: release.shortVersion ?? release.version,
                value: release.version,
              };
            })
          : []
      }
      onChange={opts => setSelectedReleases(opts.map(opt => opt.value))}
      value={selectedReleases}
      triggerLabel={
        <ButtonLabelWrapper>
          {triggerLabel}{' '}
          {selectedReleases.length > 1 && (
            <StyledBadge text={`+${selectedReleases.length - 1}`} />
          )}
        </ButtonLabelWrapper>
      }
      triggerProps={{icon: <IconReleases />}}
    />
  );
}

export default ReleasesSelectControl;

const StyledBadge = styled(Badge)`
  flex-shrink: 0;
`;

const ButtonLabelWrapper = styled('span')`
  width: 100%;
  text-align: left;
  align-items: center;
  display: inline-grid;
  grid-template-columns: 1fr auto;
`;
