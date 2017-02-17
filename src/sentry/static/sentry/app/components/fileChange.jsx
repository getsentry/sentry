import React from 'react';

import ApiMixin from '../mixins/apiMixin';

// import LoadingError from '../components/loadingError';
// import LoadingIndicator from '../components/loadingIndicator';

// import {t} from '../locale';

const FileChange = React.createClass({
  propTypes: {
    filename: React.PropTypes.string.isRequired,
    authors: React.PropTypes.object.isRequired,
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
    let {filename, authors} = this.props;
    authors = Array.from(authors);
    return (
      <li>
        <div>{filename}</div>
        {authors.map(author => {
          return (<div>{author}</div>);
        })}
      </li>
    );
  }
});

export default FileChange;