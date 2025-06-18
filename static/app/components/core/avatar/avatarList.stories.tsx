import {Fragment, useEffect} from 'react';

import Placeholder from 'sentry/components/placeholder';
import * as Storybook from 'sentry/stories';
import {useMembers} from 'sentry/utils/useMembers';
import {useUserTeams} from 'sentry/utils/useUserTeams';

import AvatarList from './avatarList';

function useLoadedMembers() {
  const {members, loadMore, ...rest} = useMembers({limit: 50});

  useEffect(() => {
    // `loadMore` is not referentially stable, so we cannot include it in the dependencies array
    loadMore();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {members, loadMore, ...rest};
}

export default Storybook.story('AvatarList', story => {
  story('Default', () => {
    const {members, fetching} = useLoadedMembers();

    return (
      <Fragment>
        <p>Your Org Members</p>
        <Storybook.SizingWindow display="block" style={{width: '50%'}}>
          {fetching ? <Placeholder /> : <AvatarList users={members} />}
        </Storybook.SizingWindow>
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
          <Storybook.SizingWindow display="block" style={{width: '50%'}}>
            {isLoading ? <Placeholder /> : <AvatarList teams={teams} />}
          </Storybook.SizingWindow>
        </p>

        <p>
          Teams and Members together
          <Storybook.SizingWindow display="block" style={{width: '50%'}}>
            {isLoading || fetching ? (
              <Placeholder />
            ) : (
              <AvatarList teams={teams} users={members} maxVisibleAvatars={10} />
            )}
          </Storybook.SizingWindow>
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
          You can set <Storybook.JSXProperty name="typeAvatars" value={String} /> at any
          time, but it's especially important when passing in teams or teams + users
          together. This is rendered as the suffix to the tooltip on the summary avatar
          "10 other users"
          <Storybook.SizingWindow display="block" style={{width: '50%'}}>
            {isLoading ? (
              <Placeholder />
            ) : (
              <AvatarList teams={teams} typeAvatars="teams" />
            )}
          </Storybook.SizingWindow>
        </p>

        <p>
          Teams and Members together
          <Storybook.SizingWindow display="block" style={{width: '50%'}}>
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
          </Storybook.SizingWindow>
        </p>
      </Fragment>
    );
  });

  story('maxVisibleAvatars vs. avatarSize', () => {
    const {members, fetching} = useLoadedMembers();

    return (
      <Fragment>
        <p>
          Default is <Storybook.JSXProperty name="avatarSize" value={28} />
          {' & '}
          <Storybook.JSXProperty name="maxVisibleAvatars" value={5} />
        </p>
        {fetching ? (
          <Placeholder />
        ) : (
          <Storybook.PropMatrix
            // Storybook.SizingWindowProps={{display: 'block'}}
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
