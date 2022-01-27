import BasePlugin from 'sentry/plugins/basePlugin';
import IssueActions from 'sentry/plugins/components/issueActions';
import {Group, Organization, Plugin, Project} from 'sentry/types';

type Props = {
  plugin: Plugin;
  group: Group;
  project: Project;
  organization: Organization;
  actionType: 'create' | 'link';
  onSuccess: (data: any) => void;
};

export class DefaultIssuePlugin extends BasePlugin {
  renderGroupActions(props: Props) {
    return <IssueActions {...props} />;
  }
}

export default DefaultIssuePlugin;
