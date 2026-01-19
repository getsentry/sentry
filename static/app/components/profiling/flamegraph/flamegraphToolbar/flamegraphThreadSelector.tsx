import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {Flex} from '@sentry/scraps/layout';

import type {SelectOption} from 'sentry/components/core/compactSelect';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {IconList} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {FlamegraphState} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphContext';
import type {ProfileGroup} from 'sentry/utils/profiling/profile/importProfile';
import type {Profile} from 'sentry/utils/profiling/profile/profile';
import {makeFormatter} from 'sentry/utils/profiling/units/units';
import useOrganization from 'sentry/utils/useOrganization';

export interface FlamegraphThreadSelectorProps {
  onThreadIdChange: (threadId: Profile['threadId']) => void;
  profileGroup: ProfileGroup;
  profileType: 'transaction profile' | 'continuous profile';
  threadId: FlamegraphState['profiles']['threadId'];
}

function FlamegraphThreadSelector({
  profileType,
  threadId,
  onThreadIdChange,
  profileGroup,
}: FlamegraphThreadSelectorProps) {
  const organization = useOrganization();

  const [profileOptions, emptyProfileOptions]: [
    Array<SelectOption<number>>,
    Array<SelectOption<number>>,
  ] = useMemo(() => {
    const profiles: Array<SelectOption<number>> = [];
    const emptyProfiles: Array<SelectOption<number>> = [];

    const activeThreadId =
      typeof profileGroup.activeProfileIndex === 'number'
        ? profileGroup.profiles[profileGroup.activeProfileIndex]?.threadId
        : undefined;

    // Sanity check and redirect to the correct thread id if the tid that was set
    // is not present in the profile group and/or points to a non existing thread.
    if (profileGroup.profiles.length > 0 && typeof threadId === 'number') {
      const profileWithThreadId = profileGroup.profiles.find(
        profile => profile.threadId === threadId
      );

      if (!profileWithThreadId) {
        const fallbackThreadId =
          profileGroup.profiles[profileGroup.activeProfileIndex]?.threadId ?? 0;

        if (fallbackThreadId !== threadId) {
          onThreadIdChange(fallbackThreadId);
          Sentry.captureMessage(
            `Thread id ${threadId} not found in profile group, redirecting to ${fallbackThreadId}`
          );
        }
      }
    }

    const sortedProfiles = [...profileGroup.profiles].sort(
      compareProfiles(activeThreadId)
    );

    sortedProfiles.forEach(profile => {
      const option = {
        label: profile.name ? profile.name : `tid(${profile.threadId})`,
        value: profile.threadId,
        details: (
          <ThreadLabelDetails
            duration={makeFormatter(profile.unit)(profile.duration)}
            // plus 1 because the last sample always has a weight of 0
            // and is not included in the raw weights
            samples={profile.rawWeights.length + 1}
          />
        ),
      };

      if (profile.rawWeights.length > 0) {
        profiles.push(option);
        return;
      }
      emptyProfiles.push(option);
      return;
    });

    return [profiles, emptyProfiles];
  }, [profileGroup, threadId, onThreadIdChange]);

  const handleChange: (opt: SelectOption<any>) => void = useCallback(
    opt => {
      if (defined(opt) && typeof opt.value === 'number') {
        onThreadIdChange(opt.value);
        trackAnalytics('profiling_views.flamegraph.thread.change', {
          organization,
          profile_type: profileType,
        });
      }
    },
    [onThreadIdChange, organization, profileType]
  );

  return (
    <StyledCompactSelect
      triggerProps={{
        icon: <IconList />,
        size: 'xs',
      }}
      options={[
        {key: 'profiles', label: t('Profiles'), options: profileOptions},
        {
          key: 'empty-profiles',
          label: t('Empty Profiles'),
          options: emptyProfileOptions,
        },
      ]}
      value={threadId ?? 0}
      onChange={handleChange}
      searchable
    />
  );
}

interface ThreadLabelDetailsProps {
  duration: string;
  samples: number;
}

function ThreadLabelDetails(props: ThreadLabelDetailsProps) {
  return (
    <Flex justify="between" gap="md">
      <div>{props.duration}</div>
      <div>{tn('%s sample', '%s samples', props.samples)}</div>
    </Flex>
  );
}

type ProfileLight = {
  name: Profile['name'];
  threadId: Profile['threadId'];
};

export function compareProfiles(activeThreadId?: number) {
  return function (a: ProfileLight, b: ProfileLight): number {
    // if one is the active thread id, it should be first
    if (defined(activeThreadId)) {
      if (a.threadId === activeThreadId) {
        return -1;
      }
      if (b.threadId === activeThreadId) {
        return 1;
      }
    }

    // if neither has a name, we use the thread id
    if (!b.name && !a.name) {
      return a.threadId > b.threadId ? 1 : -1;
    }

    // if one doesn't have a name, the other is first
    if (!b.name) {
      return -1;
    }
    if (!a.name) {
      return 1;
    }

    // if both has a name, we use the name
    return a.name > b.name ? 1 : -1;
  };
}

const StyledCompactSelect = styled(CompactSelect)`
  width: 14ch;
  min-width: 14ch;

  > button {
    width: 100%;
  }
`;
export {FlamegraphThreadSelector};
