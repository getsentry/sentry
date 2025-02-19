import {Component} from 'react';

import TagStore from 'sentry/stores/tagStore';
import type {TagCollection} from 'sentry/types/group';
import getDisplayName from 'sentry/utils/getDisplayName';

type InjectedTagsProps = {
  tags: TagCollection;
};

type State = {
  tags: TagCollection;
};

/**
 * HOC for getting *only* tags from the TagStore.
 */
function withTags<P extends InjectedTagsProps>(
  WrappedComponent: React.ComponentType<P>
): React.ComponentType<Omit<P, keyof InjectedTagsProps>> {
  class WithTags extends Component<Omit<P, keyof InjectedTagsProps>, State> {
    static displayName = `withTags(${getDisplayName(WrappedComponent)})`;

    state: State = {
      tags: TagStore.getState(),
    };

    componentWillUnmount() {
      this.unsubscribe();
    }

    unsubscribe = TagStore.listen(
      (tags: TagCollection) => this.setState({tags}),
      undefined
    );

    render() {
      const {tags, ...props} = this.props as P;
      return (
        <WrappedComponent
          tags={tags ?? this.state.tags}
          // TODO(any): HoC prop types not working w/ emotion https://github.com/emotion-js/emotion/issues/3261
          {...(props as P as any)}
        />
      );
    }
  }

  return WithTags;
}

export default withTags;
