import marked from "marked";
import React from "react";
import TimeSince from "../../components/timeSince";
import ConfigStore from "../../stores/configStore";
import LinkWithConfirmation from "../../components/linkWithConfirmation";

var Note = React.createClass({
  canEdit() {
    var user = ConfigStore.get('user');
    return user.isSuperuser || user.id === this.props.item.user.id;
  },

  render() {
    var {item, author, onEdit, onDelete} = this.props;

    var noteBody = marked(item.data.text);
    return (
      <div>
        <TimeSince date={item.dateCreated} />
        <div className="activity-author">{author.name}
        {this.canEdit() &&
          <span className="editor-tools">
            <a onClick={onEdit}>Edit</a>
            <LinkWithConfirmation
              className="danger"
              message="Are you sure you wish to delete this comment?"
              onConfirm={onDelete}>Remove</LinkWithConfirmation>
          </span>
        }
        </div>
        <div dangerouslySetInnerHTML={{__html: noteBody}} />
      </div>
    );
  }
});

export default Note;
