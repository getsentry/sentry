import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import AsyncComponent from 'sentry/components/asyncComponent';
import PageHeading from 'sentry/components/pageHeading';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import {Organization} from 'sentry/types/organization';
import withOrganization from 'sentry/utils/withOrganization';

import IssueSetListItem from './components/IssueSetListItem';

type Props = {
  organization: Organization;
} & RouteComponentProps<{}, {}>;

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
      <StyledPageContent>
        <PageHeading withMargins>{t('Issue Sets')}</PageHeading>
        {issueSets.map(issueSet => (
          <IssueSetListItem
            key={issueSet.id}
            issueSet={issueSet}
            organization={organization}
          />
        ))}
      </StyledPageContent>
    );
  }
}

const StyledPageContent = styled(PageContent)`
  background: ${p => p.theme.background};
`;

export default withOrganization(IssueSetOverview);
