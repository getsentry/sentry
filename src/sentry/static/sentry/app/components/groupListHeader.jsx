import React from 'react';
import {t} from '../locale';
import Toolbar from './toolbar';
import ToolbarHeader from './toolbarHeader';

const GroupListHeader = React.createClass({
  render() {
    return (
      <div className="group-header">
        <Toolbar className="stream-actions row">
          <ToolbarHeader className="stream-actions-left col-md-7 col-sm-8 col-xs-8">
            {t('Event')}
          </ToolbarHeader>
          <ToolbarHeader className="hidden-sm hidden-xs stream-actions-graph col-md-2 col-md-offset-1 align-right">
            {t('Last 24 hours')}
          </ToolbarHeader>
          <ToolbarHeader className="stream-actions-count align-right col-md-1 col-sm-2 col-xs-2">
            {t('events')}
          </ToolbarHeader>
          <ToolbarHeader className="stream-actions-users align-right col-md-1 col-sm-2 col-xs-2">
            {t('users')}
          </ToolbarHeader>
        </Toolbar>
      </div>
    );
  }
});

export default GroupListHeader;
