import {Fragment, useEffect} from 'react';

import AvatarList from 'sentry/components/avatar/avatarList';
import Placeholder from 'sentry/components/placeholder';
import JSXProperty from 'sentry/components/stories/jsxProperty';
import Matrix from 'sentry/components/stories/matrix';
import SizingWindow from 'sentry/components/stories/sizingWindow';
import storyBook from 'sentry/stories/storyBook';
import {useMembers} from 'sentry/utils/useMembers';
import {useUserTeams} from 'sentry/utils/useUserTeams';

function useLoadedMembers() {
  const {members, loadMore, ...rest} = useMembers({limit: 50});

  useEffect(() => {
    // `loadMore` is not referentially stable, so we cannot include it in the dependencies array
    loadMore();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {members, loadMore, ...rest};
}

export default storyBook('AvatarList', story => {
  story('Default', () => {
    const {members, fetching} = useLoadedMembers();

    return (
      <Fragment>
        <p>Your Org Members</p>
        <SizingWindow display="block" style={{width: '50%'}}>
          {fetching ? <Placeholder /> : <AvatarList users={members} />}
        </SizingWindow>
      </Fragment>
    );
  });

  story('Combine users & members', () => {
    const {teams, isLoading} = useUserTeams();
    const {members, fetching} = useLoadedMembers();

    return (
      <Fragment>
        <p>
          Your Teams
          <SizingWindow display="block" style={{width: '50%'}}>
            {isLoading ? <Placeholder /> : <AvatarList teams={teams} />}
          </SizingWindow>
        </p>

        <p>
          Teams and Members together
          <SizingWindow display="block" style={{width: '50%'}}>
            {isLoading || fetching ? (
              <Placeholder />
            ) : (
              <AvatarList teams={teams} users={members} maxVisibleAvatars={10} />
            )}
          </SizingWindow>
        </p>
      </Fragment>
    );
  });

  story('typeAvatars', () => {
    const {teams, isLoading} = useUserTeams();
    const {members, fetching} = useLoadedMembers();

    return (
      <Fragment>
        <p>
          You can set <JSXProperty name="typeAvatars" value={String} /> at any time, but
          it's especially important when passing in teams or teams + users together. This
          is rendered as the suffix to the tooltip on the summary avatar "10 other users"
          <SizingWindow display="block" style={{width: '50%'}}>
            {isLoading ? (
              <Placeholder />
            ) : (
              <AvatarList teams={teams} typeAvatars="teams" />
            )}
          </SizingWindow>
        </p>

        <p>
          Teams and Members together
          <SizingWindow display="block" style={{width: '50%'}}>
            {isLoading || fetching ? (
              <Placeholder />
            ) : (
              <AvatarList
                teams={teams}
                users={members}
                maxVisibleAvatars={10}
                typeAvatars="users and teams"
              />
            )}
          </SizingWindow>
        </p>
      </Fragment>
    );
  });

  story('maxVisibleAvatars vs. avatarSize', () => {
    const {members, fetching} = useLoadedMembers();

    return (
      <Fragment>
        <p>
          Default is <JSXProperty name="avatarSize" value={28} />
          {' & '}
          <JSXProperty name="maxVisibleAvatars" value={5} />
        </p>
        {fetching ? (
          <Placeholder />
        ) : (
          <Matrix
            sizingWindowProps={{display: 'block'}}
            render={AvatarList}
            selectedProps={['avatarSize', 'maxVisibleAvatars']}
            propMatrix={{
              avatarSize: [25, 28],
              maxVisibleAvatars: [10, 5, 3, 1],
              users: [members],
            }}
          />
        )}
      </Fragment>
    );
  });
});
