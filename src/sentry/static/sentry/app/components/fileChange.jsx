import React from 'react';

import ApiMixin from '../mixins/apiMixin';

// import LoadingError from '../components/loadingError';
// import LoadingIndicator from '../components/loadingIndicator';

// import {t} from '../locale';

const FileChange = React.createClass({
  propTypes: {
    filename: React.PropTypes.string.isRequired,
    author: React.PropTypes.string.isRequired,
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
    let {filename, author} = this.props;
    return (
      <li>
        <div>{filename}{author}</div>
      </li>
    );
  }
});

export default FileChange;