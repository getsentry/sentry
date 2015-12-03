import React from 'react';
import ApiMixin from '../../mixins/apiMixin';
import IndicatorStore from '../../stores/indicatorStore';
import GroupStore from '../../stores/groupStore';

import Note from './note';
import NoteInput from './noteInput';
import {t} from '../../locale';

const NoteContainer = React.createClass({
  mixins: [
    ApiMixin
  ],

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
    let {group, item} = this.props;
    // Optimistically remove from UI
    let index = GroupStore.removeActivity(group.id, item.id);
    if (index === -1) {
        // I dunno, the id wasn't found in the GroupStore
        return;
    }

    let loadingIndicator = IndicatorStore.add(t('Removing comment..'));

    this.api.request('/issues/' + group.id + '/comments/' + item.id + '/' , {
      method: 'DELETE',
      error: (error) => {
        // TODO(mattrobenolt): Show an actual error that this failed,
        // but just bring it back in place for now
        GroupStore.addActivity(group.id, item, index);
      },
      complete: () => {
        IndicatorStore.remove(loadingIndicator);
      }
    });
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
