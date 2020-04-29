import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';
import omit from 'lodash/omit';

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

/**
 * TODO(mark) Remove these options and have TagStore only contain tags.
 * Add new HOCs that layer in the event + issue attributes as needed.
 */
type Options = {
  /**
   * Set to true if you want to include issue attributes in the tag list
   * that is forwarded to the wrapped component.
   */
  includeIssueAttributes?: boolean;
  /**
   * Set to true if you want to include event properties
   */
  includeEventAttributes?: boolean;
};

const ISSUE_TAGS: TagCollection = TagStore.getIssueAttributes();

function filterTags(tags: TagCollection, options: Options): TagCollection {
  const out: TagCollection = {...tags};
  if (options.includeEventAttributes) {
    TagStore.getBuiltInTags().forEach((tag: Tag) => (out[tag.key] = tag));
  }

  if (options.includeIssueAttributes) {
    // timestamp is replaced by event.timestamp
    // environment is in the globalSelectionHeader.
    return omit(out, ['environment', 'timestamp']);
  }

  // Remove issue attributes as they are include by default by TagStore
  // for now.
  Object.keys(ISSUE_TAGS).forEach(key => delete out[key]);

  return out;
}

const withTags = <P extends InjectedTagsProps>(
  WrappedComponent: React.ComponentType<P>,
  {includeIssueAttributes = false, includeEventAttributes = true}: Options = {}
) =>
  createReactClass<Omit<P, keyof InjectedTagsProps>, State>({
    displayName: `withTags(${getDisplayName(WrappedComponent)})`,
    mixins: [Reflux.listenTo(TagStore, 'onTagsUpdate') as any],

    getInitialState() {
      return {
        tags: filterTags(TagStore.getAllTags(), {
          includeIssueAttributes,
          includeEventAttributes,
        }),
      };
    },

    onTagsUpdate(tags: TagCollection) {
      this.setState({
        tags: filterTags(tags, {includeIssueAttributes, includeEventAttributes}),
      });
    },

    render() {
      return <WrappedComponent tags={this.state.tags} {...(this.props as P)} />;
    },
  });

export default withTags;
