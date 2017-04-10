import jQuery from 'jquery';
import React from 'react';
import {Link} from 'react-router';

import ApiMixin from '../mixins/apiMixin';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import {t} from '../locale';

export default React.createClass({
  propTypes: {
    setProjectNavSection: React.PropTypes.func
  },

  mixins: [ApiMixin],

  componentWillMount() {
    this.props.setProjectNavSection('audience');
  },

  render() {
    return (
      <div>
        <div className="release-list-header">
          <h3>{t('Audience')}</h3>
        </div>
        <div className="panel panel-default">
          {this.props.children}
        </div>
      </div>
    );
  },
});
