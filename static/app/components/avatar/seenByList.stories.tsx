import {Fragment, useEffect} from 'react';

import SeenByList from 'sentry/components/avatar/seenByList';
import Placeholder from 'sentry/components/placeholder';
import JSXProperty from 'sentry/components/stories/jsxProperty';
import Matrix from 'sentry/components/stories/matrix';
import SizingWindow from 'sentry/components/stories/sizingWindow';
import storyBook from 'sentry/stories/storyBook';
import {useMembers} from 'sentry/utils/useMembers';
import {useUser} from 'sentry/utils/useUser';

function useLoadedMembers() {
  const {members, loadMore, ...rest} = useMembers();

  useEffect(() => {
    // `loadMore` is not referentially stable, so we cannot include it in the dependencies array
    loadMore();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {members, loadMore, ...rest};
}

export default storyBook('SeenByList', story => {
  story('Default', () => {
    const {members, fetching} = useLoadedMembers();

    return (
      <SizingWindow display="block" style={{width: '50%'}}>
        {fetching ? <Placeholder /> : <SeenByList seenBy={members} />}
      </SizingWindow>
    );
  });

  story('iconTooltip', () => {
    const {members, fetching} = useLoadedMembers();

    return (
      <Fragment>
        <p>
          Default is{' '}
          <JSXProperty name="iconTooltip" value="People who have viewed this" />
        </p>
        <SizingWindow display="block" style={{width: '50%'}}>
          {fetching ? (
            <Placeholder />
          ) : (
            <SeenByList
              seenBy={members}
              iconTooltip="These folks have all seen this record"
            />
          )}
        </SizingWindow>
      </Fragment>
    );
  });

  story('Always shows users except yourself', () => {
    const user = useUser();
    const {members, fetching} = useLoadedMembers();

    return (
      <Fragment>
        <p>
          In this example we've explicitly put `user` at the start of the list, that's
          you! But it'll be filtered out. The idea is that that viewer is more interested
          in who else has seen a resource. On the issue stream, for example, we indicate
          if the viewer (you) has seen an issue by changing the font-weight to normal
          after viewed.
        </p>
        <SizingWindow display="block" style={{width: '50%'}}>
          {fetching ? <Placeholder /> : <SeenByList seenBy={[user, ...members]} />}
        </SizingWindow>
      </Fragment>
    );
  });

  story('avatarSize', () => {
    const {members, fetching} = useLoadedMembers();

    return (
      <Fragment>
        <p>
          Default is <JSXProperty name="avatarSize" value={28} />
        </p>
        {fetching ? (
          <Placeholder />
        ) : (
          <Matrix
            sizingWindowProps={{display: 'block'}}
            render={SeenByList}
            selectedProps={['avatarSize']}
            propMatrix={{
              avatarSize: [12, 16, 20, 24, 28, 30],
              seenBy: [members],
            }}
          />
        )}
      </Fragment>
    );
  });

  story('maxVisibleAvatars', () => {
    const {members, fetching} = useLoadedMembers();

    return (
      <Fragment>
        <p>
          Default is <JSXProperty name="maxVisibleAvatars" value={10} />
        </p>
        {fetching ? (
          <Placeholder />
        ) : (
          <Matrix
            sizingWindowProps={{display: 'block'}}
            render={SeenByList}
            selectedProps={['maxVisibleAvatars']}
            propMatrix={{
              maxVisibleAvatars: [10, 5, 3, 1],
              seenBy: [members],
            }}
          />
        )}
      </Fragment>
    );
  });

  story('iconPosition', () => {
    const {members, fetching} = useLoadedMembers();

    return (
      <Fragment>
        <p>
          Default is <JSXProperty name="iconPosition" value="left" />
        </p>
        {fetching ? (
          <Placeholder />
        ) : (
          <Matrix
            sizingWindowProps={{display: 'block'}}
            render={SeenByList}
            selectedProps={['iconPosition']}
            propMatrix={{
              iconPosition: ['left', 'right'],
              seenBy: [members],
            }}
          />
        )}
      </Fragment>
    );
  });
});
