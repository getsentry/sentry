import React from 'react';

import ApiMixin from '../mixins/apiMixin';

// import LoadingError from '../components/loadingError';
// import LoadingIndicator from '../components/loadingIndicator';

// import {t} from '../locale';

const FileChange = React.createClass({
  propTypes: {
    filename: React.PropTypes.string.isRequired,
    authors: React.PropTypes.object.isRequired,
    types: React.PropTypes.object.isRequired,
  },

  mixins: [
    ApiMixin
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
      <li div className="row">
        <div className="col-sm-4">{filename}</div>
        <div className="col-sm-4">
        {authors.map(author => {
          return (<span>{author} </span>);
        })}
        </div>
        <div className="col-sm-4">
        {types.map(type => {
          if (type ===  'A') {
            return (<span>Added </span>);
          }
          else if (type === 'D') {
            return (<span>Deleted </span>);
          }
          else if (type === 'M') {
            return (<span>Modified </span>);
          }
        })}
        </div>
      </li>
    );
  }
});

export default FileChange;