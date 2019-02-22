import React from 'react';

import BasePlugin from 'app/plugins/basePlugin';
import IssueActions from 'app/plugins/components/issueActions';

export class DefaultIssuePlugin extends BasePlugin {
  renderGroupActions(props) {
    return <IssueActions plugin={this} {...props} />;
  }
}

DefaultIssuePlugin.DefaultIssueActions = IssueActions;

export default DefaultIssuePlugin;
