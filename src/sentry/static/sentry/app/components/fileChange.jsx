import React from 'react';
import Avatar from '../components/avatar';
import IconFileGeneric from '../icons/icon-file-generic';

import TooltipMixin from '../mixins/tooltip';
import ApiMixin from '../mixins/apiMixin';

const FileChange = React.createClass({
  propTypes: {
    filename: React.PropTypes.string.isRequired,
    authors: React.PropTypes.array.isRequired,
    types: React.PropTypes.object.isRequired
  },

  mixins: [
    ApiMixin,
    TooltipMixin({
      selector: '.tip'
    })
  ],

  getInitialState() {
    return {
      loading: true
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
                <span
                  key={i}
                  className="avatar-grid-item m-b-0 tip"
                  title={author.name + ' ' + author.email}>
                  <Avatar user={author} />
                </span>
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
  }
});

export default FileChange;
