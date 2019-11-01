import PropTypes from 'prop-types';
import React from 'react';
import moment from 'moment';

import {defined} from 'app/utils';
import HttpRenderer from 'app/components/events/interfaces/breadcrumbs/httpRenderer';
import ErrorRenderer from 'app/components/events/interfaces/breadcrumbs/errorRenderer';
import DefaultRenderer from 'app/components/events/interfaces/breadcrumbs/defaultRenderer';
import ErrorBoundary from 'app/components/errorBoundary';
import Tooltip from 'app/components/tooltip';

const CUSTOM_RENDERERS = {
  http: HttpRenderer,
  error: ErrorRenderer,
};

class Breadcrumb extends React.Component {
  static propTypes = {
    crumb: PropTypes.object.isRequired,
  };

  getClassName = () => {
    const {crumb} = this.props;

    // use Set to avoid duplicate crumb classes (was previously adding
    // values like "crumb-default" as many as three times)
    const classes = new Set(['crumb', 'crumb-default', 'crumb-' + crumb.level]);

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

  getTooltipTitle = () => {
    const {crumb} = this.props;
    const parsedTimestamp = moment(crumb.timestamp);
    const timestampFormat = parsedTimestamp.milliseconds() ? 'll H:mm:ss.SSS A' : 'lll';
    return parsedTimestamp.format(timestampFormat);
  };

  renderType = () => {
    const {crumb} = this.props;
    const Renderer = CUSTOM_RENDERERS[crumb.type] || DefaultRenderer;
    return <Renderer crumb={crumb} />;
  };

  render() {
    const {crumb} = this.props;
    return (
      <li className={this.getClassName()}>
        <ErrorBoundary mini css={{margin: 0, borderRadius: 0}}>
          <span className="icon-container">
            <span className="icon" />
          </span>
          {defined(crumb.timestamp) ? (
            <Tooltip title={this.getTooltipTitle()}>
              <span className="dt">{moment(crumb.timestamp).format('HH:mm:ss')}</span>
            </Tooltip>
          ) : (
            <span className="dt" />
          )}
          {this.renderType()}
        </ErrorBoundary>
      </li>
    );
  }
}

export default Breadcrumb;
