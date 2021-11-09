import {Component, Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import * as Layout from 'app/components/layouts/thirds';
import {Panel} from 'app/components/panels';
import {t} from 'app/locale';
import {Organization} from 'app/types';
import {Event} from 'app/types/event';
import Breadcrumb from 'app/views/performance/breadcrumb';

import TraceView from './traceView';
import TransactionSummary from './transactionSummary';
import {isTransactionEvent} from './utils';

type Props = Pick<
  RouteComponentProps<{baselineEventSlug: string; regressionEventSlug: string}, {}>,
  'params' | 'location'
> & {
  organization: Organization;
  baselineEvent: Event;
  regressionEvent: Event;
};

class TransactionComparisonContent extends Component<Props> {
  getTransactionName() {
    const {baselineEvent, regressionEvent} = this.props;

    if (isTransactionEvent(baselineEvent) && isTransactionEvent(regressionEvent)) {
      if (baselineEvent.title === regressionEvent.title) {
        return baselineEvent.title;
      }

      return t('mixed transaction names');
    }

    if (isTransactionEvent(baselineEvent)) {
      return baselineEvent.title;
    }

    if (isTransactionEvent(regressionEvent)) {
      return regressionEvent.title;
    }

    return t('no transaction title found');
  }

  render() {
    const {baselineEvent, regressionEvent, organization, location, params} = this.props;

    // const transactionName =
    //   baselineEvent.title === regressionEvent.title ? baselineEvent.title : undefined;

    return (
      <Fragment>
        <Layout.Header>
          <Layout.HeaderContent>
            <Breadcrumb
              organization={organization}
              location={location}
              // TODO: add this back in if transaction comparison is used
              // transaction={{
              //   project: <insert project id>,
              //   name: transactionName,
              // }}
              transactionComparison
            />
            <Layout.Title>{this.getTransactionName()}</Layout.Title>
          </Layout.HeaderContent>
          <Layout.HeaderActions>
            <TransactionSummary
              organization={organization}
              location={location}
              params={params}
              baselineEvent={baselineEvent}
              regressionEvent={regressionEvent}
            />
          </Layout.HeaderActions>
        </Layout.Header>
        <Layout.Body>
          <StyledPanel>
            <TraceView baselineEvent={baselineEvent} regressionEvent={regressionEvent} />
          </StyledPanel>
        </Layout.Body>
      </Fragment>
    );
  }
}

const StyledPanel = styled(Panel)`
  grid-column: 1 / span 2;
  overflow: hidden;
`;

export default TransactionComparisonContent;
