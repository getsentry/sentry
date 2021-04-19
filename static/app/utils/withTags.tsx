import React from 'react';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';

import TagStore from 'app/stores/tagStore';
import {TagCollection} from 'app/types';
import getDisplayName from 'app/utils/getDisplayName';

type InjectedTagsProps = {
  tags: TagCollection;
};

type State = {
  tags: TagCollection;
};

/**
 * HOC for getting *only* tags from the TagStore.
 */
const withTags = <P extends InjectedTagsProps>(
  WrappedComponent: React.ComponentType<P>
) =>
  createReactClass<Omit<P, keyof InjectedTagsProps>, State>({
    displayName: `withTags(${getDisplayName(WrappedComponent)})`,
    mixins: [Reflux.listenTo(TagStore, 'onTagsUpdate') as any],

    getInitialState() {
      return {
        tags: TagStore.getAllTags(),
      };
    },

    onTagsUpdate(tags: TagCollection) {
      this.setState({
        tags,
      });
    },

    render() {
      const {tags, ...props} = this.props as P;
      return <WrappedComponent {...({tags: tags ?? this.state.tags, ...props} as P)} />;
    },
  });

export default withTags;
