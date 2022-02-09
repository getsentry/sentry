import BasePlugin from 'sentry/plugins/basePlugin';
import IssueActions from 'sentry/plugins/components/issueActions';
import {Group, Organization, Plugin, Project} from 'sentry/types';

type Props = {
  actionType: 'create' | 'link';
  group: Group;
  onSuccess: (data: any) => void;
  organization: Organization;
  plugin: Plugin;
  project: Project;
};

export class DefaultIssuePlugin extends BasePlugin {
  renderGroupActions(props: Props) {
    return <IssueActions {...props} />;
  }
}

export default DefaultIssuePlugin;
