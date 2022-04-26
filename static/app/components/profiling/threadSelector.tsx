import {useCallback, useMemo} from 'react';

import CompactSelect from 'sentry/components/forms/compactSelect';
import {ControlProps, GeneralSelectValue} from 'sentry/components/forms/selectControl';
import {IconList} from 'sentry/icons';
import {SelectValue} from 'sentry/types';
import {defined} from 'sentry/utils';
import {ProfileGroup} from 'sentry/utils/profiling/profile/importProfile';
import {Profile} from 'sentry/utils/profiling/profile/profile';

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
      }))
      .sort(compareProfiles)
      .map(item => ({label: item.name, value: item.index}));
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

export {ThreadMenuSelector};
