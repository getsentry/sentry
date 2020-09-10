import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';

import getDisplayName from 'app/utils/getDisplayName';
import TagStore from 'app/stores/tagStore';
import {TagCollection} from 'app/types';

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
      const {tags = this.state.tags as TagCollection} = this.props as P;
      return <WrappedComponent {...(this.props as P)} tags={tags} />;
    },
  });

export default withTags;
