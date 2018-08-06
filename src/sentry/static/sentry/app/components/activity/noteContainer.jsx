import PropTypes from 'prop-types';
import React from 'react';

import Note from 'app/components/activity/note';
import NoteInput from 'app/components/activity/noteInput';

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
    let {group, item, author, sessionUser, memberList} = this.props;

    return (
      <li className="activity-note">
        {author.avatar}
        <div className="activity-bubble">
          {this.state.editing ? (
            <NoteInput
              group={group}
              item={item}
              onFinish={this.onFinish}
              sessionUser={sessionUser}
              memberList={memberList}
            />
          ) : (
            <Note
              item={item}
              author={author}
              onEdit={this.onEdit}
              onDelete={this.onDelete}
            />
          )}
        </div>
      </li>
    );
  }
}

export default NoteContainer;
