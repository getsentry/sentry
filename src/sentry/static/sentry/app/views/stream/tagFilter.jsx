import React from "react";
import Reflux from "reflux";
import _ from "underscore";
import DropdownLink from "../../components/dropdownLink";
import MenuItem from "../../components/menuItem";
import LoadingIndicator from "../../components/loadingIndicator";

import {fetchTagValues} from "../../api/tags";
import StreamTagStore from "../../stores/streamTagStore";

var StreamTagFilter = React.createClass({
  mixins: [
    Reflux.listenTo(StreamTagStore, "onStreamTagChange")
  ],

  contextTypes: {
    router: React.PropTypes.func
  },

  getDefaultProps() {
    return {
      tag: {},
    };
  },

  getInitialState() {
    return {
      tagValues: [],
      query: '',
      loading: false
    };
  },

  fetchTagValues: _.debounce(function(query) {
    this.setState({
      query: query,
      loading: true
    });

    let params = this.context.router.getCurrentParams();
    fetchTagValues(params, this.props.tag.key, query, () => {
      this.setState({ loading: false });
    });
  }, 300),

  onFilterChange(evt) {
    this.fetchTagValues(evt.target.value);
  },

  onStreamTagChange(tags) {
    let tag = _.find(tags, (t) => t.key === this.props.tag.key);
    if (!tag) return;

    let query = this.state.query.toLowerCase();
    this.setState({
      tagValues: _.filter(tag.values || [], (val) => val.toLowerCase().indexOf(query) > -1)
    });
  },

  render() {
    let tag = this.props.tag;

    return (
      <div>
        <h6>{tag.name}</h6>
        <DropdownLink
          className="btn btn-default btn-sm"
          title="Search a value...">
          <MenuItem noAnchor={true} key="filter">
            <input type="text" className="form-control input-sm"
                   placeholder="Filter people" ref="filter"
                   onKeyUp={this.onFilterChange} />
          </MenuItem>
          {this.state.loading ? <LoadingIndicator/> : this.state.tagValues.map((val) => {
            return <MenuItem>{val}</MenuItem>;
          })}
        </DropdownLink>
      </div>
    );
  }
});

export default StreamTagFilter;
