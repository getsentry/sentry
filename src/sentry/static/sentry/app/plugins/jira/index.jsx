import React from 'react';

import DefaultIssuePlugin from 'app/plugins/defaultIssuePlugin';

import Settings from './components/settings';
import IssueActions from './components/issueActions';

class Jira extends DefaultIssuePlugin {
  renderSettings(props) {
    return <Settings plugin={this} {...props} />;
  }

  renderGroupActions(props) {
    return <IssueActions plugin={this} {...props} />;
  }
}

Jira.displayName = 'Jira';

export default Jira;
