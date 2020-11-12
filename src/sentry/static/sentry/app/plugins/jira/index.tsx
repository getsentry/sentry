import React from 'react';

import BasePlugin from 'app/plugins/basePlugin';
import DefaultIssuePlugin from 'app/plugins/defaultIssuePlugin';

import Settings from './components/settings';
import IssueActions from './components/issueActions';

class Jira extends DefaultIssuePlugin {
  displayName = 'Jira';
  renderSettings(props: Parameters<typeof BasePlugin.prototype.renderSettings>[0]) {
    return <Settings plugin={this.plugin} {...props} />;
  }

  renderGroupActions(
    props: Parameters<typeof DefaultIssuePlugin.prototype.renderGroupActions>[0]
  ) {
    return <IssueActions {...props} />;
  }
}

export default Jira;
