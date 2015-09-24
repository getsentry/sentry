import React from "react";
import Reflux from "reflux";
import _ from "underscore";
import DropdownLink from "../../components/dropdownLink";
import MenuItem from "../../components/menuItem";
import LoadingIndicator from "../../components/loadingIndicator";

import {fetchTagValues} from "../../api/tags";
import StreamTagStore from "../../stores/streamTagStore";

var KEYUP_DEBOUNCE_MS = 300;

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
      loading: false,
      selectedValue: 'Select a value'
    };
  },

  fetchTagValues: _.debounce(function() {
    let query = this.state.query;

    this.setState({
      loading: true
    });

    let params = this.context.router.getCurrentParams();
    fetchTagValues(params, this.props.tag.key, query, () => {
      this.setState({ loading: false });
    });
  }, KEYUP_DEBOUNCE_MS),

  onFilterChange(evt) {
    let query = evt.target.value;
    this.setState({
      query: query,
    }, () => {
      if (this.props.tag.predefined) {
        return void this.filterTagValues();
      }
      this.fetchTagValues();
    });
  },

  filterTagValues() {
    let query = this.state.query.toLowerCase();
    let tag = this.props.tag;

    this.setState({
      tagValues: _.filter(tag.values || [], (val) => val.toLowerCase().indexOf(query) > -1)
    });
  },

  onStreamTagChange(tags) {
    // The store broadcasts changes to *all* tags. We are only
    // interested in changes to *this* tag.
    let tag = _.find(tags, (t) => t.key === this.props.tag.key);
    if (!tag) return;

    this.filterTagValues();
  },

  onSelectValue(val, evt) {
    this.setState({
      selectedValue: val
    });
  },

  render() {
    let tag = this.props.tag;

    return (
      <div>
        <h6>{tag.name}</h6>
        <DropdownLink
          className="btn btn-default btn-sm"
          title={this.state.selectedValue}>
          <MenuItem noAnchor={true} key="filter">
            <input type="text"
              className="form-control input-sm"
              placeholder={`Filter ${this.props.tag.name}`}
              ref="filter"
              onKeyUp={this.onFilterChange} />
          </MenuItem>
          {this.state.loading
            ? <LoadingIndicator/>
            : this.state.tagValues.map((val) => {
                return (
                  <MenuItem key={val} onSelect={this.onSelectValue.bind(this, val)}>
                  {val}
                  </MenuItem>
                );
              })
          }
        </DropdownLink>
      </div>
    );
  }
});

export default StreamTagFilter;
