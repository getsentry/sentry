import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import ActivityItem from 'app/components/activity/item';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';

import EditorTools from './editorTools';
import NoteBody from './body';
import NoteHeader from './header';
import NoteInput from './input';

class Note extends React.Component {
  static propTypes = {
    author: PropTypes.object.isRequired,
    item: PropTypes.object.isRequired,
    text: PropTypes.string.isRequired,
    memberList: PropTypes.array.isRequired,
    teams: PropTypes.arrayOf(SentryTypes.Team).isRequired,

    // pass through to ActivityItem
    // shows absolute time instead of a relative string
    showTime: PropTypes.bool,

    // pass through to ActivityItem
    // hides the date/timestamp in header
    hideDate: PropTypes.bool,

    // min-height for NoteInput textarea
    minHeight: PropTypes.number,

    onDelete: PropTypes.func,
    onCreate: PropTypes.func,
    onUpdate: PropTypes.func,
  };

  constructor(...args) {
    super(...args);
    this.state = {
      editing: false,
    };
  }

  handleEdit = () => {
    this.setState({editing: true});
  };

  handleEditFinish = () => {
    this.setState({editing: false});
  };

  handleDelete = () => {
    const {item, onDelete} = this.props;

    onDelete(item);
  };

  handleCreate = note => {
    const {onCreate} = this.props;

    onCreate(note);
  };

  handleUpdate = note => {
    const {item, onUpdate} = this.props;

    onUpdate(note, item);
    this.setState({editing: false});
  };

  render() {
    const {
      item,
      text,
      author,
      teams,
      memberList,
      hideDate,
      minHeight,
      showTime,
    } = this.props;

    const activityItemProps = {
      hideDate,
      showTime,
      id: `activity-item-${item.id}`,
      author: {type: 'user', user: item.user},
      date: item.dateCreated,
    };

    if (!this.state.editing) {
      return (
        <ActivityItemWithEditing
          {...activityItemProps}
          header={
            <NoteHeader
              author={author}
              user={item.user}
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
            minHeight={minHeight}
            item={item}
            text={text}
            onEditFinish={this.handleEditFinish}
            onUpdate={this.handleUpdate}
            onCreate={this.handleCreate}
            memberList={memberList}
            teams={teams}
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
    background: ${p => p.theme.offWhite2};

    p:last-child {
      margin-bottom: 0;
    }
  }
`;

const ActivityItemWithEditing = styled(StyledActivityItem)`
  &:hover {
    /* stylelint-disable-next-line no-duplicate-selectors */
    ${EditorTools} {
      display: inline-block;
    }
  }
`;

export default Note;
