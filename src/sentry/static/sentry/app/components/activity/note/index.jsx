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
    memberList: PropTypes.array.isRequired,
    teams: PropTypes.arrayOf(SentryTypes.Team),

    onDelete: PropTypes.func.isRequired,
    onUpdate: PropTypes.func.isRequired,
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
    this.props.onDelete(this.props.item);
  };

  render() {
    const {item, author, teams, memberList} = this.props;

    const activityItemProps = {
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
          <NoteBody item={item} />
        </ActivityItemWithEditing>
      );
    }

    // When editing, `NoteInput` has its own header, pass render func
    // to control rendering of bubble body
    return (
      <StyledActivityItem {...activityItemProps}>
        {() => (
          <NoteInput
            item={item}
            onEditFinish={this.handleEditFinish}
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
