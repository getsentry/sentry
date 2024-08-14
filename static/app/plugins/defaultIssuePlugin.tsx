import BasePlugin from 'sentry/plugins/basePlugin';
import IssueActions from 'sentry/plugins/components/issueActions';
import type {Group} from 'sentry/types/group';
import type {Plugin} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';

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
