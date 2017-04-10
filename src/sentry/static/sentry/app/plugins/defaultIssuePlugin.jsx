import React from 'react';

import BasePlugin from './basePlugin';
import IssueActions from './components/issueActions';


export class DefaultIssuePlugin extends BasePlugin {
    renderGroupActions(props) {
        return <IssueActions plugin={this} {...props} />;
    }
}

DefaultIssuePlugin.DefaultIssueActions = IssueActions;

export default DefaultIssuePlugin;
