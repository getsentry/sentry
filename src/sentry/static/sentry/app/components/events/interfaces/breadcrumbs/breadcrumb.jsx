import PropTypes from 'prop-types';
import React from 'react';
import moment from 'moment';

import HttpRenderer from 'app/components/events/interfaces/breadcrumbs/httpRenderer';
import ErrorRenderer from 'app/components/events/interfaces/breadcrumbs/errorRenderer';
import DefaultRenderer from 'app/components/events/interfaces/breadcrumbs/defaultRenderer';

const CUSTOM_RENDERERS = {
  http: HttpRenderer,
  error: ErrorRenderer,
};

class Breadcrumb extends React.Component {
  static propTypes = {
    crumb: PropTypes.object.isRequired,
  };

  getClassName = () => {
    let {crumb} = this.props;

    // use Set to avoid duplicate crumb classes (was previously adding
    // values like "crumb-default" as many as three times)
    let classes = new Set(['crumb', 'crumb-default', 'crumb-' + crumb.level]);

    if (crumb.type !== 'default') {
      classes.add('crumb-' + crumb.type.replace(/[\s_]+/g, '-').toLowerCase());
    }

    // special case for 'ui.' category breadcrumbs
    // TODO: find a better way to customize UI around non-schema data
    if (crumb.category && crumb.category.slice(0, 3) === 'ui.') {
      classes.add('crumb-user');
    }

    if (crumb.last) {
      classes.add('crumb-last');
    }
    return [...classes].join(' ');
  };

  renderType = () => {
    let {crumb} = this.props;
    let Renderer = CUSTOM_RENDERERS[crumb.type] || DefaultRenderer;
    return <Renderer crumb={crumb} />;
  };

  render() {
    let {crumb} = this.props;
    return (
      <li className={this.getClassName()}>
        <span className="icon-container">
          <span className="icon" />
        </span>
        <span className="dt" title={moment(crumb.timestamp).format()}>
          {moment(crumb.timestamp).format('HH:mm:ss')}
        </span>
        {this.renderType()}
      </li>
    );
  }
}

export default Breadcrumb;
