import React from "react";
import api from "../../api";
import GroupStore from "../../stores/groupStore";
import IndicatorStore from "../../stores/indicatorStore";
var PureRenderMixin = require('react/addons').addons.PureRenderMixin;

var NoteInput = React.createClass({
  mixins: [PureRenderMixin],

  getInitialState() {
    return {
      loading: false,
      error: false,
      expanded: false,
      value: ''
    };
  },

  onSubmit(e) {
    e.preventDefault();

    this.setState({
      loading: true,
      error: false
    });

    var loadingIndicator = IndicatorStore.add('Posting comment..');

    api.request('/groups/' + this.props.group.id + '/notes/', {
      method: 'POST',
      data: {
        text: this.state.value
      },
      error: () => {
        this.setState({
          loading: false,
          error: true
        });
      },
      success: (data) => {
        this.setState({
          value: '',
          expanded: false,
          loading: false
        });
        GroupStore.addActivity(this.props.group.id, data);
      },
      complete: () => {
        IndicatorStore.remove(loadingIndicator);
      }
    });
  },

  onChange(e) {
    this.setState({value: e.target.value});
  },

  expand() {
    this.setState({expanded: true});
  },

  maybeCollapse() {
    if (this.state.value === '') {
      this.setState({expanded: false});
    }
  },

  render() {
    var classNames = 'activity-field';
    if (this.state.expanded) {
      classNames += ' expanded';
    }
    if (this.state.error) {
      classNames += ' error';
    }
    if (this.state.loading) {
      classNames += ' loading';
    }

    return (
      <form className={classNames} onSubmit={this.onSubmit}>
        <div className="activity-notes">
          <textarea placeholder="Add details or updates to this event"
                    onChange={this.onChange}
                    onFocus={this.expand} onBlur={this.maybeCollapse}
                    value={this.state.value} />
          <div className="activity-actions">
            <button className="btn btn-default" type="submit"
                    disabled={this.state.loading}>Leave comment</button>
          </div>
        </div>
      </form>
    );
  }
});

export default NoteInput;
