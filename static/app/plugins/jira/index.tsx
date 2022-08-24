import BasePlugin from 'sentry/plugins/basePlugin';
import DefaultIssuePlugin from 'sentry/plugins/defaultIssuePlugin';

import IssueActions from './components/issueActions';
import Settings from './components/settings';

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
