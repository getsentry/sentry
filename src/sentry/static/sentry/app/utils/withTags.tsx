import React from 'react';
import Reflux from 'reflux';

import createReactClass from 'create-react-class';
import getDisplayName from 'app/utils/getDisplayName';
import TagStore from 'app/stores/tagStore';
import {Tag} from 'app/types';

type TagCollection = {[key: string]: Tag};

type InjectedTagsProps = {
  tags: TagCollection;
};

type State = {
  tags: TagCollection;
};

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
      this.setState({tags});
    },

    render() {
      return <WrappedComponent tags={this.state.tags} {...(this.props as P)} />;
    },
  });

export default withTags;
