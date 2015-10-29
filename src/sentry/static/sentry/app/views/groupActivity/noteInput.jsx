import marked from "marked";
import React from "react";
import api from "../../api";
import GroupStore from "../../stores/groupStore";
import IndicatorStore from "../../stores/indicatorStore";
import {logException} from "../../utils/logging";
import {getItem, setItem} from "../../utils/localStorage";

import PureRenderMixin from 'react-addons-pure-render-mixin';
const localStorageKey = 'noteinput:latest';
const DEFAULT_ERROR_JSON = {detail: 'Unknown error. Please try again.'};

const NoteInput = React.createClass({
  mixins: [PureRenderMixin],

  getInitialState() {
    let {item, group} = this.props;
    let updating = !!item;
    let defaultText = '';

    if (updating) {
      defaultText = item.data.text;
    } else {
      let storage = getItem(localStorageKey);
      if (storage) {
        let {groupId, value} = JSON.parse(storage);
        if (groupId === group.id) {
          defaultText = value;
        }
      }
    }

    return {
      loading: false,
      error: false,
      errorJSON: null,
      expanded: false,
      preview: false,
      updating: updating,
      value: defaultText
    };
  },

  componentWillUpdate(nextProps, nextState) {
    // We can't support this when editing an existing Note since it'll
    // clobber the other storages
    if (this.state.updating) return;

    // Nothing changed
    if (this.state.value === nextState.value) return;

    try {
      setItem(localStorageKey, JSON.stringify({
        groupId: this.props.group.id,
        value: nextState.value
      }));
    } catch(ex) {
      logException(ex);
    }
  },

  toggleEdit() {
    this.setState({preview: false});
  },

  togglePreview() {
    this.setState({preview: true});
  },

  onSubmit(e) {
    e.preventDefault();
    this.submitForm();
  },

  submitForm() {
    this.setState({
      loading: true,
      error: false,
      errorJSON: null,
    });

    if (this.state.updating) {
      this.update();
    } else {
      this.create();
    }
  },

  create() {
    let {group} = this.props;

    let loadingIndicator = IndicatorStore.add('Posting comment..');

    api.request('/groups/' + group.id + '/notes/', {
      method: 'POST',
      data: {
        text: this.state.value
      },
      error: (error) => {
        this.setState({
          loading: false,
          preview: false,
          error: true,
          errorJSON: error.responseJSON || DEFAULT_ERROR_JSON
        });
      },
      success: (data) => {
        this.setState({
          value: '',
          preview: false,
          expanded: false,
          loading: false
        });
        GroupStore.addActivity(group.id, data);
        this.finish();
      },
      complete: () => {
        IndicatorStore.remove(loadingIndicator);
      }
    });
  },

  update() {
    let {group, item} = this.props;

    let loadingIndicator = IndicatorStore.add('Updating comment..');

    api.request('/groups/' + group.id + '/notes/' + item.id + '/', {
      method: 'PUT',
      data: {
        text: this.state.value
      },
      error: (error) => {
        this.setState({
          loading: false,
          preview: false,
          error: true,
          errorJSON: error.responseJSON || DEFAULT_ERROR_JSON
        });
      },
      success: (data) => {
        this.setState({
          preview: false,
          expanded: false,
          loading: false
        });
        GroupStore.updateActivity(group.id, item.id, {text: this.state.value});
        this.finish();
      },
      complete: () => {
        IndicatorStore.remove(loadingIndicator);
      }
    });
  },

  onChange(e) {
    this.setState({value: e.target.value});
  },

  onKeyDown(e) {
    // Auto submit the form on [meta] + Enter
    e.key === 'Enter' && e.metaKey && this.submitForm();
  },

  onCancel(e) {
    e.preventDefault();
    this.finish();
  },

  finish() {
    this.props.onFinish && this.props.onFinish();
  },

  expand(e) {
    this.setState({expanded: true});

    // HACK: Move cursor to end of text after autoFocus
    // we do this my making sure this is only done on the first
    // onFocus event
    if (!this.state._hasFocused) {
      this.setState({_hasFocused: true});
      let value = e.target.value;
      e.target.value = '';
      e.target.value = value;
    }

  },

  maybeCollapse() {
    if (this.state.value === '') {
      this.setState({expanded: false});
    }
  },

  render() {
    let {error, errorJSON, loading, preview, updating, value} = this.state;
    let classNames = 'activity-field';
    if (error) {
      classNames += ' error';
    }
    if (loading) {
      classNames += ' loading';
    }

    let btnText = updating ? 'Save' : 'Post';

    return (
      <form className={classNames} onSubmit={this.onSubmit}>
        <div className="activity-notes">
          <ul className="nav nav-tabs">
            <li className={!preview ? "active" : ""}>
              <a onClick={this.toggleEdit}>{updating ? "Edit" : "Write"}</a>
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
                      onKeyDown={this.onKeyDown}
                      onFocus={this.expand} onBlur={this.maybeCollapse}
                      required={true}
                      autoFocus={true}
                      value={value} />
          }
          <div className="activity-actions">
            {errorJSON && errorJSON.detail &&
              <small className="error">{errorJSON.detail}</small>
            }
            <button className="btn btn-default" type="submit"
                    disabled={loading}>{btnText} Comment</button>
            {updating &&
              <button className="btn btn-danger" onClick={this.onCancel}>Cancel</button>}
          </div>
        </div>
      </form>
    );
  }
});

export default NoteInput;
