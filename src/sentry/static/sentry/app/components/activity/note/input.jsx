import {MentionsInput, Mention} from 'react-mentions';
import PropTypes from 'prop-types';
import React from 'react';
import marked from 'marked';
import styled from 'react-emotion';

import {t} from 'app/locale';
import Button from 'app/components/button';
import NavTabs from 'app/components/navTabs';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import textStyles from 'app/styles/text';
import withApi from 'app/utils/withApi';

import mentionStyle from './mentionStyle';

const buildUserId = id => `user:${id}`;
const buildTeamId = id => `team:${id}`;

class NoteInput extends React.Component {
  static propTypes = {
    teams: PropTypes.arrayOf(SentryTypes.Team).isRequired,
    memberList: PropTypes.array.isRequired,

    // This is the id of the note object from the server
    // This is to indicate you are editing an existing item
    modelId: PropTypes.string,

    // The note text itself
    text: PropTypes.string,
    error: PropTypes.bool,
    errorJSON: PropTypes.shape({
      detail: PropTypes.shape({
        message: PropTypes.string,
        code: PropTypes.number,
        extra: PropTypes.any,
      }),
    }),
    placeholder: PropTypes.string,
    busy: PropTypes.bool,

    /**
     * minimum height of the textarea
     */
    minHeight: PropTypes.number,

    onEditFinish: PropTypes.func,
    onUpdate: PropTypes.func,
    onCreate: PropTypes.func,
    onChange: PropTypes.func,
  };

  static defaultProps = {
    placeholder: t('Add a comment.\nTag users with @, or teams with #'),
    minHeight: 140,
    busy: false,
  };

  constructor(props) {
    super(props);

    const {text} = props;
    const defaultText = text || '';

    this.memberMentions = [];
    this.teamMentions = [];

    this.state = {
      preview: false,
      value: defaultText,
      memberMentions: [],
      teamMentions: [],
    };
  }

  cleanMarkdown(text) {
    return text
      .replace(/\[sentry\.strip:member\]/g, '@')
      .replace(/\[sentry\.strip:team\]/g, '');
  }

  mentionableUsers() {
    const {memberList} = this.props;
    return memberList.map(member => ({
      id: buildUserId(member.id),
      display: member.name,
      email: member.email,
    }));
  }

  mentionableTeams() {
    const {teams} = this.props;
    return teams.map(team => ({
      id: buildTeamId(team.id),
      display: `#${team.slug}`,
      email: team.id,
    }));
  }

  submitForm = () => {
    if (!!this.props.modelId) {
      this.update();
    } else {
      this.create();
    }
  };

  create = () => {
    const {onCreate} = this.props;

    if (onCreate) {
      onCreate({
        text: this.cleanMarkdown(this.state.value),
        mentions: this.finalizeMentions(),
      });
    }
  };

  update = () => {
    const {onUpdate} = this.props;

    if (onUpdate) {
      onUpdate({
        text: this.state.value,
      });
    }
  };

  finish = () => {
    this.props.onEditFinish && this.props.onEditFinish();
  };

  finalizeMentions = () => {
    const {memberMentions, teamMentions} = this.state;

    // each mention looks like [id, display]
    return [...memberMentions, ...teamMentions]
      .filter(mention => this.state.value.indexOf(mention[1]) !== -1)
      .map(mention => mention[0]);
  };

  handleToggleEdit = () => {
    this.setState({preview: false});
  };

  handleTogglePreview = () => {
    this.setState({preview: true});
  };

  handleSubmit = e => {
    e.preventDefault();
    this.submitForm();
  };

  handleChange = e => {
    this.setState({value: e.target.value});

    if (this.props.onChange) {
      this.props.onChange(e, {updating: !!this.props.modelId});
    }
  };

  handleKeyDown = e => {
    // Auto submit the form on [meta] + Enter
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      this.submitForm();
    }
  };

  handleCancel = e => {
    e.preventDefault();
    this.finish();
  };

  handleAddMember = (id, display) => {
    this.setState(({memberMentions}) => ({
      memberMentions: [...memberMentions, [id, display]],
    }));
  };

  handleAddTeam = (id, display) => {
    this.setState(({teamMentions}) => ({
      teamMentions: [...teamMentions, [id, display]],
    }));
  };

  render() {
    const {preview, value} = this.state;
    const {modelId, busy, error, placeholder, minHeight, errorJSON} = this.props;

    const existingItem = !!modelId;
    const btnText = existingItem ? t('Save Comment') : t('Post Comment');

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
        onSubmit={this.handleSubmit}
      >
        <NoteInputNavTabs>
          <NoteInputNavTab className={!preview ? 'active' : ''}>
            <NoteInputNavTabLink onClick={this.handleToggleEdit}>
              {existingItem ? t('Edit') : t('Write')}
            </NoteInputNavTabLink>
          </NoteInputNavTab>
          <NoteInputNavTab className={preview ? 'active' : ''}>
            <NoteInputNavTabLink onClick={this.handleTogglePreview}>
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
              minHeight={minHeight}
              dangerouslySetInnerHTML={{__html: marked(this.cleanMarkdown(value))}}
            />
          ) : (
            <MentionsInput
              style={mentionStyle({minHeight})}
              placeholder={placeholder}
              onChange={this.handleChange}
              onBlur={this.handleBlur}
              onKeyDown={this.handleKeyDown}
              value={value}
              required={true}
              autoFocus={true}
              displayTransform={(_id, display, type) =>
                `${type === 'member' ? '@' : ''}${display}`
              }
              markup="**[sentry.strip:__type__]__display__**"
            >
              <Mention
                type="member"
                trigger="@"
                data={this.mentionableUsers()}
                onAdd={this.handleAddMember}
                appendSpaceOnAdd={true}
              />
              <Mention
                type="team"
                trigger="#"
                data={this.mentionableTeams()}
                onAdd={this.handleAddTeam}
                appendSpaceOnAdd={true}
              />
            </MentionsInput>
          )}
        </NoteInputBody>

        <Footer>
          <div>{errorMessage && <ErrorMessage>{errorMessage}</ErrorMessage>}</div>
          <div>
            {existingItem && (
              <FooterButton priority="danger" type="button" onClick={this.handleCancel}>
                {t('Cancel')}
              </FooterButton>
            )}
            <FooterButton error={errorMessage} type="submit" disabled={busy}>
              {btnText}
            </FooterButton>
          </div>
        </Footer>
      </NoteInputForm>
    );
  }
}

export {NoteInput};

export default withApi(NoteInput);

// This styles both the note preview and the note editor input
const getNotePreviewCss = p => {
  const {minHeight, padding, overflow, border} = mentionStyle(p)['&multiLine'].input;

  return `
  max-height: 1000px;
  max-width: 100%;
  ${(minHeight && `min-height: ${minHeight}px`) || ''};
  padding: ${padding};
  overflow: ${overflow};
  border: ${border};
`;
};

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
  ${getNotePreviewCss};
  padding-bottom: ${space(1)};
`;
