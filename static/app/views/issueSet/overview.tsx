import {RouteComponentProps} from 'react-router';

import AsyncComponent from 'sentry/components/asyncComponent';
import PageHeading from 'sentry/components/pageHeading';
import {Panel} from 'sentry/components/panels';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import {Organization} from 'sentry/types/organization';
import withOrganization from 'sentry/utils/withOrganization';

import IssueSetPanelItem from './components/IssueSetPanelItem';

type Props = {
  organization: Organization;
} & RouteComponentProps<{searchId?: string}, {}>;

type State = any;

class IssueSetOverview extends AsyncComponent<Props, State> {
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization} = this.props;
    return [['issueSets', `/organizations/${organization.slug}/issue-sets/`]];
  }

  renderBody() {
    const {organization} = this.props;
    const {issueSets} = this.state;
    return (
      <PageContent>
        <PageHeading withMargins>{t('Issue Sets')}</PageHeading>
        <Panel>
          {issueSets.map(issueSet => (
            <IssueSetPanelItem
              key={issueSet.id}
              issueSet={issueSet}
              organization={organization}
            />
          ))}
        </Panel>
      </PageContent>
    );
  }
}

export default withOrganization(IssueSetOverview);
