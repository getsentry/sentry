import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import ActivityItem from 'app/components/activity/activityItem';
import EditorTools from 'app/components/activity/editorTools';
import NoteBody from 'app/components/activity/noteBody';
import NoteHeader from 'app/components/activity/noteHeader';
import NoteInput from 'app/components/activity/noteInput';
import space from 'app/styles/space';

class NoteContainer extends React.Component {
  static propTypes = {
    group: PropTypes.object.isRequired,
    item: PropTypes.object.isRequired,
    author: PropTypes.object.isRequired,
    onDelete: PropTypes.func.isRequired,
    sessionUser: PropTypes.object.isRequired,
    memberList: PropTypes.array.isRequired,
  };

  constructor(...args) {
    super(...args);
    this.state = {
      editing: false,
    };
  }

  onEdit = () => {
    this.setState({editing: true});
  };

  onFinish = () => {
    this.setState({editing: false});
  };

  onDelete = () => {
    this.props.onDelete(this.props.item);
  };

  render() {
    const {group, item, author, sessionUser, memberList} = this.props;

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
              onEdit={this.onEdit}
              onDelete={this.onDelete}
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
            group={group}
            item={item}
            onFinish={this.onFinish}
            sessionUser={sessionUser}
            memberList={memberList}
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
    /* stylelint-disable-next-line no-duplicate-selectors:0 */
    ${EditorTools} {
      display: inline-block;
    }
  }
`;

export default NoteContainer;
