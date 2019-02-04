import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import marked from 'marked';
import classNames from 'classnames';

import {MentionsInput, Mention} from 'react-mentions';
import _ from 'lodash';

import ApiMixin from 'app/mixins/apiMixin';
import OrganizationState from 'app/mixins/organizationState';

import GroupStore from 'app/stores/groupStore';
import ProjectsStore from 'app/stores/projectsStore';
import IndicatorStore from 'app/stores/indicatorStore';
import {logException} from 'app/utils/logging';
import localStorage from 'app/utils/localStorage';
import NavTabs from 'app/components/navTabs';
import {t} from 'app/locale';
import mentionsStyle from 'app/../styles/mentions-styles';

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

  mixins: [ApiMixin, OrganizationState],

  getInitialState() {
    const {item, group} = this.props;
    const updating = !!item;
    let defaultText = '';

    if (updating) {
      defaultText = item.data.text;
    } else {
      const storage = localStorage.getItem(localStorageKey);
      if (storage) {
        const {groupId, value} = JSON.parse(storage);
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
      mentionableUsers: this.mentionableUsers(),
      mentionableTeams: this.mentionableTeams(),
    };
  },

  componentWillUpdate(nextProps, nextState) {
    if (!_.isEqual(nextProps.memberList, this.props.memberList)) {
      this.setState({
        mentionableUsers: this.mentionableUsers(),
        mentionableTeams: this.mentionableTeams(),
      });
    }

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
    return text
      .replace(/\[sentry\.strip:member\]/g, '@')
      .replace(/\[sentry\.strip:team\]/g, '');
  },

  create() {
    const {group} = this.props;

    const loadingIndicator = IndicatorStore.add(t('Posting comment..'));

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
    const {group, item} = this.props;

    const loadingIndicator = IndicatorStore.add(t('Updating comment..'));

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
    const {memberMentions, teamMentions} = this.state;

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
      const value = e.target.value;
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
    const {memberList, sessionUser} = this.props;
    return _.uniqBy(memberList, ({id}) => id)
      .filter(member => sessionUser.id !== member.id)
      .map(member => ({
        id: buildUserId(member.id),
        display: member.name,
        email: member.email,
      }));
  },

  mentionableTeams() {
    const {group} = this.props;
    return (ProjectsStore.getBySlug(group.project.slug) || {
      teams: [],
    }).teams.map(team => ({
      id: buildTeamId(team.id),
      display: `#${team.slug}`,
      email: team.id,
    }));
  },

  render() {
    const {
      error,
      errorJSON,
      loading,
      preview,
      updating,
      value,
      mentionableUsers,
      mentionableTeams,
    } = this.state;

    const placeHolderText = t(
      'Add details or updates to this event. \nTag users with @, or teams with #'
    );

    const btnText = updating ? t('Save Comment') : t('Post Comment');

    const errorMessage =
      (errorJSON &&
        (typeof errorJSON.detail === 'string'
          ? errorJSON.detail
          : (errorJSON.detail && errorJSON.detail.message) ||
            t('Unable to post comment'))) ||
      null;
    return (
      <form
        noValidate
        className={classNames('activity-field', {
          error,
          loading,
        })}
        onSubmit={this.onSubmit}
      >
        <div className="activity-notes">
          <NavTabs>
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
          </NavTabs>
          {preview ? (
            <div
              className="note-preview"
              dangerouslySetInnerHTML={{__html: marked(this.cleanMarkdown(value))}}
            />
          ) : (
            <MentionsInput
              style={mentionsStyle}
              placeholder={placeHolderText}
              onChange={this.onChange}
              onBlur={this.onBlur}
              onKeyDown={this.onKeyDown}
              value={value}
              required={true}
              autoFocus={true}
              displayTransform={(id, display, type) =>
                `${type === 'member' ? '@' : ''}${display}`}
              markup="**[sentry.strip:__type__]__display__**"
            >
              <Mention
                type="member"
                trigger="@"
                data={mentionableUsers}
                onAdd={this.onAddMember}
                appendSpaceOnAdd={true}
              />
              <Mention
                type="team"
                trigger="#"
                data={mentionableTeams}
                onAdd={this.onAddTeam}
                appendSpaceOnAdd={true}
              />
            </MentionsInput>
          )}
          <div className="activity-actions">
            {errorMessage && <small className="error">{errorMessage}</small>}
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
