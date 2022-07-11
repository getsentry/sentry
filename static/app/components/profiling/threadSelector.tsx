import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import CompactSelect from 'sentry/components/forms/compactSelect';
import {ControlProps, GeneralSelectValue} from 'sentry/components/forms/selectControl';
import {IconList} from 'sentry/icons';
import {tn} from 'sentry/locale';
import space from 'sentry/styles/space';
import {SelectValue} from 'sentry/types';
import {defined} from 'sentry/utils';
import {FlamegraphState} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/index';
import {ProfileGroup} from 'sentry/utils/profiling/profile/importProfile';
import {Profile} from 'sentry/utils/profiling/profile/profile';
import {makeFormatter} from 'sentry/utils/profiling/units/units';

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
    return [...profileGroup.profiles].sort(compareProfiles).map(profile => ({
      label: profile.name
        ? `tid (${profile.threadId}): ${profile.name}`
        : `tid (${profile.threadId})`,
      value: profile.threadId,
      details: (
        <ThreadLabelDetails
          duration={makeFormatter(profile.unit)(profile.duration)}
          samples={profile.samples.length}
        />
      ),
    }));
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
        size: 'xs',
      }}
      options={options}
      value={threadId}
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

const DetailsContainer = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  gap: ${space(1)};
`;

export {ThreadMenuSelector};
