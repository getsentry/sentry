import React from 'react';
import DocumentTitle from 'react-document-title';

import {PageContent} from 'app/styles/organization';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import {Organization} from 'app/types';
import {metric} from 'app/utils/analytics';
import withOrganization, {isLightweightOrganization} from 'app/utils/withOrganization';

type Props = {
  organization: Organization;
};

class IssueListContainer extends React.Component<Props> {
  componentDidMount() {
    // Setup here as render() may be expensive
    this.startMetricCollection();
  }

  /**
   * The user can (1) land on IssueList as the first page as they enter Sentry,
   * or (2) navigate into IssueList with the stores preloaded with data.
   *
   * Case (1) will be slower and we can easily identify it as it uses the
   * lightweight organization
   */
  startMetricCollection() {
    const isLightWeight: boolean = isLightweightOrganization(this.props.organization);
    const startType: string = isLightWeight ? 'cold-start' : 'warm-start';
    metric.mark({name: 'page-issue-list-start', data: {start_type: startType}});
    metric.startTransaction({
      name: '/organizations/:orgId/issues/',
      op: isLightWeight ? 'pageload manual-first-paint' : 'navigation manual-first-paint',
    });
  }

  getTitle() {
    return `Issues - ${this.props.organization.slug} - Sentry`;
  }

  render() {
    const {organization, children} = this.props;

    return (
      <DocumentTitle title={this.getTitle()}>
        <GlobalSelectionHeader>
          <LightWeightNoProjectMessage organization={organization}>
            {children}
          </LightWeightNoProjectMessage>
        </GlobalSelectionHeader>
      </DocumentTitle>
    );
  }
}
export default withOrganization(IssueListContainer);
export {IssueListContainer};
