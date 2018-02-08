import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import marked from 'marked';
import {MentionsInput, Mention} from 'react-mentions';
import _ from 'lodash';

import ApiMixin from '../../mixins/apiMixin';
import GroupStore from '../../stores/groupStore';
import TeamStore from '../../stores/teamStore';
import IndicatorStore from '../../stores/indicatorStore';
import {logException} from '../../utils/logging';
import localStorage from '../../utils/localStorage';
import {t} from '../../locale';
import mentionsStyle from '../../../styles/mentions-styles';

const localStorageKey = 'noteinput:latest';

function makeDefaultErrorJson() {
  return {detail: t('Unknown error. Please try again.')};
}

const buildUserId = id => `user:${id}`;
const buildTeamId = id => `team:${id}`;

const NoteInput = createReactClass({
  displayName: 'NoteInput',

  propTypes: {
    item: PropTypes.object,
    group: PropTypes.object.isRequired,
    onFinish: PropTypes.func,
    memberList: PropTypes.array.isRequired,
    sessionUser: PropTypes.object.isRequired,
  },

  mixins: [ApiMixin],

  getInitialState() {
    let {item, group} = this.props;
    let updating = !!item;
    let defaultText = '';

    if (updating) {
      defaultText = item.data.text;
    } else {
      let storage = localStorage.getItem(localStorageKey);
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
      updating,
      value: defaultText,
      memberMentions: [],
      teamMentions: [],
    };
  },

  componentWillUpdate(nextProps, nextState) {
    // We can't support this when editing an existing Note since it'll
    // clobber the other storages
    if (this.state.updating) return;

    // Nothing changed
    if (this.state.value === nextState.value) return;

    try {
      localStorage.setItem(
        localStorageKey,
        JSON.stringify({
          groupId: this.props.group.id,
          value: nextState.value,
        })
      );
    } catch (ex) {
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

  cleanMarkdown(text) {
    return text.replace(/\[sentry\.strip:(team|member)\]/g, '');
  },

  create() {
    let {group} = this.props;

    let loadingIndicator = IndicatorStore.add(t('Posting comment..'));

    this.api.request('/issues/' + group.id + '/comments/', {
      method: 'POST',
      data: {
        text: this.cleanMarkdown(this.state.value),
        mentions: this.finalizeMentions(),
      },
      error: error => {
        this.setState({
          loading: false,
          preview: false,
          error: true,
          errorJSON: error.responseJSON || makeDefaultErrorJson(),
        });
      },
      success: data => {
        this.setState({
          value: '',
          preview: false,
          expanded: false,
          loading: false,
          mentions: [],
        });
        GroupStore.addActivity(group.id, data);
        this.finish();
      },
      complete: () => {
        IndicatorStore.remove(loadingIndicator);
      },
    });
  },

  update() {
    let {group, item} = this.props;

    let loadingIndicator = IndicatorStore.add(t('Updating comment..'));

    this.api.request('/issues/' + group.id + '/comments/' + item.id + '/', {
      method: 'PUT',
      data: {
        text: this.state.value,
      },
      error: error => {
        this.setState({
          loading: false,
          preview: false,
          error: true,
          errorJSON: error.responseJSON || makeDefaultErrorJson(),
        });
        IndicatorStore.remove(loadingIndicator);
      },
      success: data => {
        this.setState({
          preview: false,
          expanded: false,
          loading: false,
        });
        GroupStore.updateActivity(group.id, item.id, {text: this.state.value});
        IndicatorStore.remove(loadingIndicator);
        this.finish();
      },
    });
  },

  onChange(e) {
    this.setState({value: e.target.value});
  },

  onKeyDown(e) {
    // Auto submit the form on [meta] + Enter
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      this.submitForm();
    }
  },

  onCancel(e) {
    e.preventDefault();
    this.finish();
  },

  onAddMember(id, display) {
    this.setState(({memberMentions}) => ({
      memberMentions: [...memberMentions, [id, display]],
    }));
  },

  onAddTeam(id, display) {
    this.setState(({teamMentions}) => ({
      teamMentions: [...teamMentions, [id, display]],
    }));
  },

  finish() {
    this.props.onFinish && this.props.onFinish();
  },

  finalizeMentions() {
    let {memberMentions, teamMentions} = this.state;

    // each mention looks like [id, display]
    return [...memberMentions, ...teamMentions]
      .filter(mention => this.state.value.indexOf(mention[1]) !== -1)
      .map(mention => mention[0]);
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

  mentionableUsers() {
    let {memberList, sessionUser} = this.props;
    return _.uniqBy(memberList, ({id}) => id)
      .filter(member => sessionUser.id !== member.id)
      .map(member => ({
        id: buildUserId(member.id),
        display: member.name,
        email: member.email,
      }));
  },

  mentionableTeams() {
    let {group} = this.props;
    return _.uniqBy(TeamStore.getAll(), ({id}) => id)
      .filter(({projects}) => projects.find(p => p.slug === group.project.slug) !== -1)
      .map(team => ({
        id: buildTeamId(team.id),
        display: team.slug,
        email: team.id,
      }));
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

    let btnText = updating ? t('Save Comment') : t('Post Comment');

    return (
      <form noValidate className={classNames} onSubmit={this.onSubmit}>
        <div className="activity-notes">
          <ul className="nav nav-tabs">
            <li className={!preview ? 'active' : ''}>
              <a onClick={this.toggleEdit}>{updating ? t('Edit') : t('Write')}</a>
            </li>
            <li className={preview ? 'active' : ''}>
              <a onClick={this.togglePreview}>{t('Preview')}</a>
            </li>
            <li className="markdown">
              <span className="icon-markdown" />
              <span className="supported">{t('Markdown supported')}</span>
            </li>
          </ul>
          {preview ? (
            <div
              className="note-preview"
              dangerouslySetInnerHTML={{__html: marked(value)}}
            />
          ) : (
            <MentionsInput
              style={mentionsStyle}
              placeholder={t(
                'Add details or updates to this event.\nTag users with @, or teams with #.'
              )}
              onChange={this.onChange}
              onBlur={this.onBlur}
              onKeyDown={this.onKeyDown}
              value={value}
              required={true}
              autoFocus={true}
              markup="**__display__[sentry.strip:__type__]**"
            >
              <Mention
                type="member"
                trigger="@"
                data={this.mentionableUsers()}
                onAdd={this.onAddMember}
                appendSpaceOnAdd={true}
              />
              <Mention
                type="team"
                trigger="#"
                data={this.mentionableTeams()}
                onAdd={this.onAddTeam}
                appendSpaceOnAdd={true}
              />
            </MentionsInput>
          )}
          <div className="activity-actions">
            {errorJSON &&
              errorJSON.detail && <small className="error">{errorJSON.detail}</small>}
            <button className="btn btn-default" type="submit" disabled={loading}>
              {btnText}
            </button>
            {updating && (
              <button className="btn btn-danger" onClick={this.onCancel}>
                {t('Cancel')}
              </button>
            )}
          </div>
        </div>
      </form>
    );
  },
});

export default NoteInput;
// displayTransform={(id, display, type) =>
// `${type === 'member' ? '@' : '#'}${display}`}
