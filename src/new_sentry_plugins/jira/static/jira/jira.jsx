import React from 'react';
import {plugins} from 'sentry';

import Settings from './components/settings';
import IssueActions from './components/issueActions';

class Jira extends plugins.DefaultIssuePlugin {
    renderSettings(props) {
        return <Settings plugin={this} {...props} />;
    }

    renderGroupActions(props) {
        return <IssueActions plugin={this} {...props} />
    }
}

Jira.displayName = 'Jira';

plugins.add('jira', Jira);

export default Jira;
