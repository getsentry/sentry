import React from 'react';
import moment from 'moment';

import HttpRenderer from './httpRenderer';
import ErrorRenderer from './errorRenderer';
import DefaultRenderer from './defaultRenderer';

const CUSTOM_RENDERERS = {
  http: HttpRenderer,
  error: ErrorRenderer,
};


const Breadcrumb = React.createClass({
  propTypes: {
    crumb: React.PropTypes.object.isRequired,
  },

  getClassName() {
    let {crumb} = this.props;
    let rv = 'crumb crumb-default crumb-' + crumb.level;
    if (crumb.type !== 'default') {
      rv += ' crumb-' + crumb.type.replace(/[\s_]+/g, '-').toLowerCase();
    }
    // special case for 'ui.' category breadcrumbs
    // TODO: find a better way to customize UI around non-schema data
    if (crumb.category && crumb.category.slice(0, 3) === 'ui.') {
      rv += ' crumb-user';
    }
    return rv;
  },

  renderType() {
    let {crumb} = this.props;
    let Renderer = CUSTOM_RENDERERS[crumb.type] || DefaultRenderer;
    return (
      <Renderer crumb={crumb} />
    );
  },

  render() {
    return (
      <li className={this.getClassName()}>
        <span className="icon-container">
          <span className="icon"/>
        </span>
        <span className="dt">
          {moment(this.props.crumb.timestamp).format('HH:mm:ss')}
        </span>
        {this.renderType()}
      </li>
    );
  }
});

export default Breadcrumb;
