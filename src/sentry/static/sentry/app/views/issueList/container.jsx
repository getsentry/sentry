import React from 'react';
import DocumentTitle from 'react-document-title';

import {PageContent} from 'app/styles/organization';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import SentryTypes from 'app/sentryTypes';
import {metric} from 'app/utils/analytics';
import withOrganization, {isLightweightOrganization} from 'app/utils/withOrganization';

class IssueListContainer extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization,
  };

  constructor(props) {
    super(props);

    // Setup in the constructor as render() may be expensive
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
    const startType = isLightweightOrganization(this.props.organization)
      ? 'cold-start'
      : 'warm-start';
    metric.mark({name: 'page-issue-list-start', data: {start_type: startType}});
    metric.createSpan({
      op: 'load',
      description: 'issue-list-load',
      label: 'issue-list-load',
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
          <PageContent>
            <LightWeightNoProjectMessage organization={organization}>
              {children}
            </LightWeightNoProjectMessage>
          </PageContent>
        </GlobalSelectionHeader>
      </DocumentTitle>
    );
  }
}
export default withOrganization(IssueListContainer);
export {IssueListContainer};
