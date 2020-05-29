import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import ActivityItem from 'app/components/activity/item';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';

import EditorTools from './editorTools';
import NoteBody from './body';
import NoteHeader from './header';
import NoteInput from './input';

class Note extends React.Component {
  static propTypes = {
    // String for author name to be displayed in header
    // This is not completely derived from `props.user` because we can set a default from parent component
    authorName: PropTypes.string.isRequired,

    // This is the id of the note object from the server
    // This is to indicate you are editing an existing item
    modelId: PropTypes.string,

    // The note text itself
    text: PropTypes.string.isRequired,

    user: SentryTypes.User,

    dateCreated: PropTypes.oneOfType([PropTypes.instanceOf(Date), PropTypes.string]),

    // pass through to ActivityItem
    // shows absolute time instead of a relative string
    showTime: PropTypes.bool,

    // pass through to ActivityItem
    // hides the date/timestamp in header
    hideDate: PropTypes.bool,

    // min-height for NoteInput textarea
    minHeight: PropTypes.number,

    // If used, will fetch list of teams/members that can be mentioned for projects
    projectSlugs: PropTypes.arrayOf(PropTypes.string),

    onDelete: PropTypes.func,
    onCreate: PropTypes.func,
    onUpdate: PropTypes.func,
  };

  state = {
    editing: false,
  };

  handleEdit = () => {
    this.setState({editing: true});
  };

  handleEditFinish = () => {
    this.setState({editing: false});
  };

  handleDelete = () => {
    const {onDelete} = this.props;

    onDelete(this.props);
  };

  handleCreate = note => {
    const {onCreate} = this.props;

    onCreate(note);
  };

  handleUpdate = note => {
    const {onUpdate} = this.props;

    onUpdate(note, this.props);
    this.setState({editing: false});
  };

  render() {
    const {
      modelId,
      user,
      dateCreated,
      text,
      authorName,
      hideDate,
      minHeight,
      showTime,
      projectSlugs,
    } = this.props;

    const activityItemProps = {
      hideDate,
      showTime,
      id: `activity-item-${modelId}`,
      author: {type: 'user', user},
      date: dateCreated,
    };

    if (!this.state.editing) {
      return (
        <ActivityItemWithEditing
          {...activityItemProps}
          header={
            <NoteHeader
              authorName={authorName}
              user={user}
              onEdit={this.handleEdit}
              onDelete={this.handleDelete}
            />
          }
        >
          <NoteBody text={text} />
        </ActivityItemWithEditing>
      );
    }

    // When editing, `NoteInput` has its own header, pass render func
    // to control rendering of bubble body
    return (
      <StyledActivityItem {...activityItemProps}>
        {() => (
          <NoteInput
            modelId={modelId}
            minHeight={minHeight}
            text={text}
            onEditFinish={this.handleEditFinish}
            onUpdate={this.handleUpdate}
            onCreate={this.handleCreate}
            projectSlugs={projectSlugs}
          />
        )}
      </StyledActivityItem>
    );
  }
}

const StyledActivityItem = styled(ActivityItem)`
  /* this was nested under ".activity-note.activity-bubble" */
  ul {
    list-style: disc;
  }

  h1,
  h2,
  h3,
  h4,
  p,
  ul:not(.nav),
  ol,
  pre,
  hr,
  blockquote {
    margin-bottom: ${space(2)};
  }

  ul:not(.nav),
  ol {
    padding-left: 20px;
  }

  p {
    a {
      word-wrap: break-word;
    }
  }

  blockquote {
    font-size: 15px;
    background: ${p => p.theme.gray300};

    p:last-child {
      margin-bottom: 0;
    }
  }
`;

const ActivityItemWithEditing = styled(StyledActivityItem)`
  &:hover {
    ${EditorTools} {
      display: inline-block;
    }
  }
`;

export default Note;
