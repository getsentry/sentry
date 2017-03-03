import React from 'react';

import Note from './note';
import NoteInput from './noteInput';

const NoteContainer = React.createClass({
  propTypes: {
    group: React.PropTypes.object.isRequired,
    item: React.PropTypes.object.isRequired,
    author: React.PropTypes.object.isRequired,
    onDelete: React.PropTypes.func.isRequired
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
    let {group, item, author} = this.props;

    return (
      <li className="activity-note">
        {author.avatar}
        <div className="activity-bubble">
        {this.state.editing ?
          <NoteInput
            group={group}
            item={item}
            onFinish={this.onFinish} />
        :
          <Note
            item={item}
            author={author}
            onEdit={this.onEdit}
            onDelete={this.onDelete} />
        }
        </div>
      </li>
    );
  }
});

export default NoteContainer;
