import React from 'react';

import Note from './note';
import NoteInput from './noteInput';

const NoteContainer = React.createClass({
  propTypes: {
    group: React.PropTypes.object.isRequired,
    item: React.PropTypes.object.isRequired,
    author: React.PropTypes.object.isRequired,
    onDelete: React.PropTypes.func.isRequired,
    sessionUser: React.PropTypes.object.isRequired,
    memberList: React.PropTypes.array.isRequired
  },

  getInitialState() {
    return {
      editing: false
    };
  },

  onEdit() {
    this.setState({editing: true});
  },

  onFinish() {
    this.setState({editing: false});
  },

  onDelete() {
    this.props.onDelete(this.props.item);
  },

  render() {
    let {group, item, author, sessionUser, memberList} = this.props;

    return (
      <li className="activity-note">
        {author.avatar}
        <div className="activity-bubble">
          {this.state.editing
            ? <NoteInput
                group={group}
                item={item}
                onFinish={this.onFinish}
                sessionUser={sessionUser}
                memberList={memberList}
              />
            : <Note
                item={item}
                author={author}
                onEdit={this.onEdit}
                onDelete={this.onDelete}
              />}
        </div>
      </li>
    );
  }
});

export default NoteContainer;
