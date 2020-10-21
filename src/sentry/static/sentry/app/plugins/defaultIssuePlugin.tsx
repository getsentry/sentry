import BasePlugin from 'app/plugins/basePlugin';
import IssueActions from 'app/plugins/components/issueActions';
import {Plugin, Group, Project, Organization} from 'app/types';

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
