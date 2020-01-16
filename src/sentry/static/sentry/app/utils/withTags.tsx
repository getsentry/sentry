import React from 'react';
import Reflux from 'reflux';

import createReactClass from 'create-react-class';
import getDisplayName from 'app/utils/getDisplayName';
import {Client} from 'app/api';
import SentryTypes from 'app/sentryTypes';
import TagStore from 'app/stores/tagStore';
import {loadOrganizationTags} from 'app/actionCreators/tags';
import GlobalSelectionStore from 'app/stores/globalSelectionStore';
import {GlobalSelection, Organization, Tag} from 'app/types';

type TagCollection = {[key: string]: Tag};

type InjectedTagsProps = {
  tags: TagCollection;
};

type WrapperProps = {
  organization: Organization;
};

type State = {
  tags: TagCollection;
  selection: GlobalSelection;
};

const withTags = <P extends InjectedTagsProps & WrapperProps>(
  WrappedComponent: React.ComponentType<P>
) =>
  createReactClass<Omit<P, keyof InjectedTagsProps> & WrapperProps, State>({
    displayName: `withTags(${getDisplayName(WrappedComponent)})`,
    propTypes: {
      organization: SentryTypes.Organization,
    },
    mixins: [
      Reflux.listenTo(TagStore, 'onTagsUpdate') as any,
      Reflux.listenTo(GlobalSelectionStore, 'onSelectionUpdate') as any,
    ],

    getInitialState() {
      return {
        tags: TagStore.getAllTags(),
        selection: GlobalSelectionStore.get(),
      };
    },

    componentDidMount() {
      this.api = new Client();
      this.fetchData();
    },

    componentDidUpdate(_prevProps, prevState) {
      if (prevState.selection !== this.state.selection) {
        this.fetchData();
      }
    },

    fetchData() {
      // Load the tags, and rely on store updates to handle success
      loadOrganizationTags(this.api, this.props.organization.slug, this.state.selection);
    },

    onTagsUpdate(tags: TagCollection) {
      this.setState({...this.state, tags});
    },

    onSelectionUpdate(selection: GlobalSelection) {
      this.setState({...this.state, selection});
    },

    render() {
      return <WrappedComponent tags={this.state.tags} {...this.props as P} />;
    },
  });

export default withTags;
