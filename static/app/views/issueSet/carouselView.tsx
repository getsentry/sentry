import {RouteComponentProps} from 'react-router';

import AsyncComponent from 'sentry/components/asyncComponent';
import PageHeading from 'sentry/components/pageHeading';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import {Organization} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';

import IssueSetCarousel from './components/IssueSetCarousel';

type Props = {
  organization: Organization;
} & RouteComponentProps<{issueSetId?: string}, {}>;

type State = any;

class IssueSetCarouselView extends AsyncComponent<Props, State> {
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {
      organization,
      params: {issueSetId},
    } = this.props;
    return [
      ['issueSet', `/organizations/${organization.slug}/issue-sets/${issueSetId}/`],
      ['projects', `/organizations/${organization.slug}/projects/`],
    ];
  }

  renderBody() {
    const {organization} = this.props;
    const {issueSet, projects} = this.state;
    return (
      <PageContent>
        <PageHeading withMargins>{issueSet.name ?? t('Issue Carousel')}</PageHeading>
        <IssueSetCarousel
          issueSet={issueSet}
          issues={issueSet.items.map(item => item.issueDetails)}
          projects={projects}
          organization={organization}
        />
      </PageContent>
    );
  }
}

export default withOrganization(IssueSetCarouselView);
