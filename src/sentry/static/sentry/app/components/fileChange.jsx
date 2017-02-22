import React from 'react';
import Avatar from '../components/Avatar';

import TooltipMixin from '../mixins/tooltip';
import ApiMixin from '../mixins/apiMixin';

import {t} from '../locale';

const FileChange = React.createClass({
  propTypes: {
    filename: React.PropTypes.string.isRequired,
    authors: React.PropTypes.object.isRequired,
    types: React.PropTypes.object.isRequired,
  },

  mixins: [
    ApiMixin,
    TooltipMixin({
      selector: '.tip'
    }),
  ],

  getInitialState() {
    return {
      loading: true,
    };
  },

  render() {
    let {filename, authors, types} = this.props;
    authors = Array.from(authors);
    types = Array.from(types);
    return (
      <li className="row">
        <div className="col-sm-3">{filename}</div>
        <div className="col-sm-3 avatar-grid">
        {authors.map(author => {
            return (
              <span className="avatar-grid-item tip"
                   title={author.name + ' ' + author.email}>
                <Avatar user={author}/>
              </span>);
        })}
        </div>
        <div className="col-sm-3">
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
        </div>
      </li>
    );
  }
});

export default FileChange;