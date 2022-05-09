import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import CompactSelect from 'sentry/components/forms/compactSelect';
import {ControlProps, GeneralSelectValue} from 'sentry/components/forms/selectControl';
import {IconList} from 'sentry/icons';
import {tn} from 'sentry/locale';
import space from 'sentry/styles/space';
import {SelectValue} from 'sentry/types';
import {defined} from 'sentry/utils';
import {ProfileGroup} from 'sentry/utils/profiling/profile/importProfile';
import {Profile} from 'sentry/utils/profiling/profile/profile';
import {makeFormatter} from 'sentry/utils/profiling/units/units';

interface ThreadSelectorProps {
  activeProfileIndex: ProfileGroup['activeProfileIndex'];
  onProfileIndexChange: (index: number) => void;
  profileGroup: ProfileGroup;
}

function ThreadMenuSelector<OptionType extends GeneralSelectValue = GeneralSelectValue>({
  activeProfileIndex,
  onProfileIndexChange,
  profileGroup,
}: ThreadSelectorProps) {
  const options: SelectValue<number>[] = useMemo(() => {
    return profileGroup.profiles
      .map((profile, i) => ({
        name: profile.name,
        duration: profile.duration,
        index: i,
        formatter: makeFormatter(profile.unit),
        samples: profile.samples.length,
        threadId: profile.threadId,
      }))
      .sort(compareProfiles)
      .map(item => ({
        label: item.name ? item.name : `tid (${item.threadId})`,
        value: item.index,
        details: (
          <ThreadLabelDetails
            duration={item.formatter(item.duration)}
            samples={item.samples}
          />
        ),
      }));
  }, [profileGroup]);

  const handleChange: NonNullable<ControlProps<OptionType>['onChange']> = useCallback(
    opt => {
      if (defined(opt)) {
        onProfileIndexChange(opt.value);
      }
    },
    [onProfileIndexChange]
  );

  return (
    <CompactSelect
      triggerProps={{
        icon: <IconList size="xs" />,
        size: 'xsmall',
      }}
      options={options}
      value={activeProfileIndex}
      onChange={handleChange}
      isSearchable
    />
  );
}

interface ThreadLabelDetailsProps {
  duration: string;
  samples: number;
}

function ThreadLabelDetails(props: ThreadLabelDetailsProps) {
  return (
    <DetailsContainer>
      <div>{props.duration}</div>
      <div>{tn('%s sample', '%s samples', props.samples)}</div>
    </DetailsContainer>
  );
}

type ProfileLight = {
  duration: Profile['duration'];
  index: number;
  name: Profile['name'];
};

function compareProfiles(a: ProfileLight, b: ProfileLight): number {
  if (!b.duration) {
    return -1;
  }
  if (!a.duration) {
    return 1;
  }

  if (a.name.startsWith('(tid') && b.name.startsWith('(tid')) {
    return -1;
  }
  if (a.name.startsWith('(tid')) {
    return -1;
  }
  if (b.name.startsWith('(tid')) {
    return -1;
  }
  if (a.name.includes('main')) {
    return -1;
  }
  if (b.name.includes('main')) {
    return 1;
  }
  return a.name > b.name ? -1 : 1;
}

const DetailsContainer = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  gap: ${space(1)};
`;

export {ThreadMenuSelector};
