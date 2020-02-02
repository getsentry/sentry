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

type Options = {
  /**
   * Set to true if you want to include issue attributes in the tag listt
   * that is forwarded to the wrapped component.
   */
  includeIssueAttributes?: boolean;
};

const ISSUE_TAGS: TagCollection = TagStore.getIssueAttributes();

function filterTags(tags: TagCollection, includeIssueAttributes: boolean): TagCollection {
  if (includeIssueAttributes) {
    return tags;
  }
  const out = Object.keys(tags).reduce((acc, name) => {
    if (!ISSUE_TAGS.hasOwnProperty(name)) {
      acc[name] = tags[name];
    }

    return acc;
  }, {});
  return out;
}

const withTags = <P extends InjectedTagsProps>(
  WrappedComponent: React.ComponentType<P>,
  {includeIssueAttributes = false}: Options = {}
) =>
  createReactClass<Omit<P, keyof InjectedTagsProps>, State>({
    displayName: `withTags(${getDisplayName(WrappedComponent)})`,
    mixins: [Reflux.listenTo(TagStore, 'onTagsUpdate') as any],

    getInitialState() {
      return {
        tags: filterTags(TagStore.getAllTags(), includeIssueAttributes),
      };
    },

    onTagsUpdate(tags: TagCollection) {
      this.setState({tags: filterTags(tags, includeIssueAttributes)});
    },

    render() {
      return <WrappedComponent tags={this.state.tags} {...(this.props as P)} />;
    },
  });

export default withTags;
