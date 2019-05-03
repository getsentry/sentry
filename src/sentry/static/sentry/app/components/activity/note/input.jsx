import {MentionsInput, Mention} from 'react-mentions';
import PropTypes from 'prop-types';
import React from 'react';
import _ from 'lodash';
import createReactClass from 'create-react-class';
import marked from 'marked';
import styled, {css} from 'react-emotion';

import {logException} from 'app/utils/logging';
import {t} from 'app/locale';
import Button from 'app/components/button';
import GroupStore from 'app/stores/groupStore';
import IndicatorStore from 'app/stores/indicatorStore';
import NavTabs from 'app/components/navTabs';
import OrganizationState from 'app/mixins/organizationState';
import ProjectsStore from 'app/stores/projectsStore';
import localStorage from 'app/utils/localStorage';
import mentionsStyle from 'app/../styles/mentions-styles';
import space from 'app/styles/space';
import textStyles from 'app/styles/text';
import withApi from 'app/utils/withApi';

const localStorageKey = 'noteinput:latest';

function makeDefaultErrorJson() {
  return {detail: t('Unknown error. Please try again.')};
}

const buildUserId = id => `user:${id}`;
const buildTeamId = id => `team:${id}`;

const NoteInput = createReactClass({
  displayName: 'NoteInput',

  propTypes: {
    api: PropTypes.object,
    item: PropTypes.object,
    group: PropTypes.object.isRequired,
    onFinish: PropTypes.func,
    memberList: PropTypes.array.isRequired,
    sessionUser: PropTypes.object.isRequired,
  },

  mixins: [OrganizationState],

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
    if (this.state.updating) {
      return;
    }

    // Nothing changed
    if (this.state.value === nextState.value) {
      return;
    }

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

    this.props.api.request('/issues/' + group.id + '/comments/', {
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

    this.props.api.request('/issues/' + group.id + '/comments/' + item.id + '/', {
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
    return (
      ProjectsStore.getBySlug(group.project.slug) || {
        teams: [],
      }
    ).teams.map(team => ({
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
      <NoteInputForm
        data-test-id="note-input-form"
        noValidate
        error={error}
        onSubmit={this.onSubmit}
      >
        <NoteInputNavTabs>
          <NoteInputNavTab className={!preview ? 'active' : ''}>
            <NoteInputNavTabLink onClick={this.toggleEdit}>
              {updating ? t('Edit') : t('Write')}
            </NoteInputNavTabLink>
          </NoteInputNavTab>
          <NoteInputNavTab className={preview ? 'active' : ''}>
            <NoteInputNavTabLink onClick={this.togglePreview}>
              {t('Preview')}
            </NoteInputNavTabLink>
          </NoteInputNavTab>
          <MarkdownTab>
            <MarkdownIcon className="icon-markdown" />
            <MarkdownSupported>{t('Markdown supported')}</MarkdownSupported>
          </MarkdownTab>
        </NoteInputNavTabs>

        <NoteInputBody>
          {preview ? (
            <NotePreview
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
                `${type === 'member' ? '@' : ''}${display}`
              }
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
        </NoteInputBody>

        <Footer>
          <div>{errorMessage && <ErrorMessage>{errorMessage}</ErrorMessage>}</div>
          <div>
            {updating && (
              <FooterButton priority="danger" type="button" onClick={this.onCancel}>
                {t('Cancel')}
              </FooterButton>
            )}
            <FooterButton error={errorMessage} type="submit" disabled={loading}>
              {btnText}
            </FooterButton>
          </div>
        </Footer>
      </NoteInputForm>
    );
  },
});

export {NoteInput};

export default withApi(NoteInput);

// This styles both the note preview and the note editor input
const notePreviewCss = css`
  display: block;
  width: 100%;
  min-height: 140px;
  max-height: 1000px;
  max-width: 100%;
  margin: 0;
  border: 0;
  padding: ${space(1.5)} ${space(2)} 0;
  overflow: auto;
`;

const getNoteInputErrorStyles = p => {
  if (!p.error) {
    return '';
  }

  return `
  color: ${p.theme.error};
  margin: -1px;
  border: 1px solid ${p.theme.error};
  border-radius: ${p.theme.borderRadius};

    &:before {
      display: block;
      content: '';
      width: 0;
      height: 0;
      border-top: 7px solid transparent;
      border-bottom: 7px solid transparent;
      border-right: 7px solid ${p.theme.red};
      position: absolute;
      left: -7px;
      top: 12px;
    }

    &:after {
      display: block;
      content: '';
      width: 0;
      height: 0;
      border-top: 6px solid transparent;
      border-bottom: 6px solid transparent;
      border-right: 6px solid #fff;
      position: absolute;
      left: -5px;
      top: 12px;
    }
  `;
};

const NoteInputForm = styled('form')`
  font-size: 15px;
  line-height: 22px;
  transition: padding 0.2s ease-in-out;

  ${getNoteInputErrorStyles}

  textarea {
    ${notePreviewCss};
  }
`;

const NoteInputBody = styled('div')`
  ${textStyles}
`;

const Footer = styled('div')`
  display: flex;
  border-top: 1px solid ${p => p.theme.borderLight};
  justify-content: space-between;
  transition: opacity 0.2s ease-in-out;
  padding-left: ${space(1.5)};
`;

const FooterButton = styled(Button)`
  font-size: 13px;
  margin: -1px -1px -1px;
  border-radius: 0 0 ${p => p.theme.borderRadius};

  ${p =>
    p.error &&
    `
  &, &:active, &:focus, &:hover {
  border-bottom-color: ${p.theme.error};
  border-right-color: ${p.theme.error};
  }
  `}
`;

const ErrorMessage = styled('span')`
  display: flex;
  align-items: center;
  height: 100%;
  color: ${p => p.theme.error};
  font-size: 0.9em;
`;

const NoteInputNavTabs = styled(NavTabs)`
  padding: ${space(1)} ${space(2)} 0;
  border-bottom: 1px solid ${p => p.theme.borderLight};
  margin-bottom: 0;
`;

const NoteInputNavTab = styled('li')`
  margin-right: 13px;
`;

const NoteInputNavTabLink = styled('a')`
  .nav-tabs > li > & {
    font-size: 15px;
    padding-bottom: 5px;
  }
`;
const MarkdownTab = styled(NoteInputNavTab)`
  .nav-tabs > & {
    display: flex;
    align-items: center;
    margin-right: 0;
    color: ${p => p.theme.gray3};

    float: right;
  }
`;

const MarkdownSupported = styled('span')`
  margin-left: ${space(0.5)};
  font-size: 14px;
`;

const MarkdownIcon = styled('span')`
  font-size: 20px;
`;

const NotePreview = styled('div')`
  ${notePreviewCss};

  padding-bottom: ${space(1)};
`;
