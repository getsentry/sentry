import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import Avatar from 'app/components/avatar';
import IconFileGeneric from 'app/icons/icon-file-generic';
import Tooltip from 'app/components/tooltip';
import ApiMixin from 'app/mixins/apiMixin';

const FileChange = createReactClass({
  displayName: 'FileChange',

  propTypes: {
    filename: PropTypes.string.isRequired,
    authors: PropTypes.array.isRequired,
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: true,
    };
  },

  render() {
    let {filename, authors} = this.props;
    // types = Array.from(types);
    return (
      <li className="list-group-item list-group-item-sm release-file-change">
        <div className="row row-flex row-center-vertically">
          <div className="col-sm-9 truncate">
            <IconFileGeneric className="icon-file-generic" size={15} />
            <span className="file-name">{filename}</span>
          </div>
          <div className="col-sm-3 avatar-grid align-right">
            {authors.map((author, i) => {
              return (
                <Tooltip key={i} title={`${author.name} ${author.email}`}>
                  <span className="avatar-grid-item m-b-0">
                    <Avatar user={author} />
                  </span>
                </Tooltip>
              );
            })}
          </div>
          {/* <div className="col-sm-3">
          {types.map(type => {
            if (type ===  'A') {
              return (<span key={type}>{t('Added')} </span>);
            }
            else if (type === 'D') {
              return (<span key={type}>{t('Deleted')} </span>);
            }
            else if (type === 'M') {
              return (<span key={type}>{t('Modified')} </span>);
            }
          })}
          </div> */}
        </div>
      </li>
    );
  },
});

export default FileChange;
