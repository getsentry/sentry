import {useCallback, useMemo} from 'react';

import CompactSelect from 'sentry/components/forms/compactSelect';
import {ControlProps, GeneralSelectValue} from 'sentry/components/forms/selectControl';
import {IconList} from 'sentry/icons';
import {SelectValue} from 'sentry/types';
import {defined} from 'sentry/utils';
import {FlamegraphState} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/index';
import {ProfileGroup} from 'sentry/utils/profiling/profile/importProfile';
import {Profile} from 'sentry/utils/profiling/profile/profile';

interface ThreadSelectorProps {
  onThreadIdChange: (threadId: Profile['threadId']) => void;
  profileGroup: ProfileGroup;
  threadId: FlamegraphState['profiles']['threadId'];
}

function ThreadMenuSelector<OptionType extends GeneralSelectValue = GeneralSelectValue>({
  threadId,
  onThreadIdChange,
  profileGroup,
}: ThreadSelectorProps) {
  const options: SelectValue<number>[] = useMemo(() => {
    return profileGroup.profiles
      .map(profile => ({
        name: profile.name,
        duration: profile.duration,
        threadId: profile.threadId,
      }))
      .sort(compareProfiles)
      .map(item => ({label: item.name, value: item.threadId}));
  }, [profileGroup]);

  const handleChange: NonNullable<ControlProps<OptionType>['onChange']> = useCallback(
    opt => {
      if (defined(opt)) {
        onThreadIdChange(opt.value);
      }
    },
    [onThreadIdChange]
  );

  return (
    <CompactSelect
      triggerProps={{
        icon: <IconList size="xs" />,
        size: 'xsmall',
      }}
      options={options}
      value={threadId}
      onChange={handleChange}
      isSearchable
    />
  );
}

type ProfileLight = {
  duration: Profile['duration'];
  name: Profile['name'];
  threadId: Profile['threadId'];
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
