import marked from "marked";
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
      errorJSON: null,
      expanded: false,
      preview: false,
      value: ''
    };
  },

  toggleEdit() {
    this.setState({preview: false});
  },

  togglePreview() {
    this.setState({preview: true});
  },

  onSubmit(e) {
    e.preventDefault();

    this.setState({
      loading: true,
      error: false,
      errorJSON: null,
    });

    var loadingIndicator = IndicatorStore.add('Posting comment..');

    api.request('/groups/' + this.props.group.id + '/notes/', {
      method: 'POST',
      data: {
        text: this.state.value
      },
      error: (error) => {
        this.setState({
          loading: false,
          preview: false,
          error: true,
          errorJSON: JSON.parse(error.responseJSON)
        });
      },
      success: (data) => {
        this.setState({
          value: '',
          preview: false,
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
    var {error, errorJSON, loading, preview, value} = this.state
    var classNames = 'activity-field';
    if (error) {
      classNames += ' error';
    }
    if (loading) {
      classNames += ' loading';
    }

    return (
      <form className={classNames} onSubmit={this.onSubmit}>
        <div className="activity-notes">
          <ul className="nav nav-tabs">
            <li className={!preview ? "active" : ""}>
              <a onClick={this.toggleEdit}>Edit</a>
            </li>
            <li className={preview ? "active" : ""}>
              <a onClick={this.togglePreview}>Preview</a>
            </li>
          </ul>
          {preview ?
            <div className="note-preview"
                 dangerouslySetInnerHTML={{__html: marked(value)}} />
          :
            <textarea placeholder="Add details or updates to this event"
                      onChange={this.onChange}
                      onFocus={this.expand} onBlur={this.maybeCollapse}
                      required={true}
                      value={value} />
          }
          <div className="activity-actions">
            {errorJSON && errorJSON.detail &&
              <small className="error">{errorJSON.detail}</small>
            }
            <button className="btn btn-default" type="submit"
                    disabled={loading}>Leave comment</button>
          </div>
        </div>
      </form>
    );
  }
});

export default NoteInput;
