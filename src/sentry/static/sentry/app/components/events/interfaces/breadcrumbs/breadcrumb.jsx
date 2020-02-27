import PropTypes from 'prop-types';
import React from 'react';
import moment from 'moment';

import {defined} from 'app/utils';
import HttpRenderer from 'app/components/events/interfaces/breadcrumbs/httpRenderer';
import ErrorRenderer from 'app/components/events/interfaces/breadcrumbs/errorRenderer';
import DefaultRenderer from 'app/components/events/interfaces/breadcrumbs/defaultRenderer';
import ErrorBoundary from 'app/components/errorBoundary';
import Tooltip from 'app/components/tooltip';
import getDynamicText from 'app/utils/getDynamicText';

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

    // special case for 'ui.' and `sentry.` category breadcrumbs
    // TODO: find a better way to customize UI around non-schema data
    const isDotSeparatedCategory = /.+\..+/.test(crumb.category);
    if (isDotSeparatedCategory) {
      const [category, subcategory] = crumb.category.split('.');
      if (category === 'ui') {
        classes.add('crumb-user');
      } else if (category === 'sentry' && subcategory === 'transaction') {
        // Warning has a precedence over other icons, so we want to force it.
        classes.delete('crumb-warning');
        classes.add('crumb-navigation');
      }
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
    switch (crumb.type) {
      case 'error':
        return <ErrorRenderer crumb={crumb} />;
      case 'http':
        return <HttpRenderer crumb={crumb} />;
      default:
        return <DefaultRenderer crumb={crumb} />;
    }
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
              <span className="dt">
                {getDynamicText({
                  value: moment(crumb.timestamp).format('HH:mm:ss'),
                  fixed: '00:00:00',
                })}
              </span>
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
