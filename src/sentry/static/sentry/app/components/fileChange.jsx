import PropTypes from 'prop-types';
import React from 'react';
import AvatarList from 'app/components/avatar/avatarList';
import {IconFile} from 'app/icons';

class FileChange extends React.PureComponent {
  static propTypes = {
    filename: PropTypes.string.isRequired,
    authors: PropTypes.array.isRequired,
  };

  constructor(props) {
    super(props);
    this.state = {
      loading: true,
    };
  }

  render() {
    const {filename, authors} = this.props;
    return (
      <li className="list-group-item list-group-item-sm release-file-change">
        <div className="row row-flex row-center-vertically">
          <div className="col-sm-10 truncate file-name">
            <IconFile />
            {filename}
          </div>
          <div className="col-sm-2 align-right">
            <AvatarList users={authors} avatarSize={25} typeMember="authors" />
          </div>
        </div>
      </li>
    );
  }
}

export default FileChange;
