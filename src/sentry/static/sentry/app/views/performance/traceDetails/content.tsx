import React from 'react';
import {Params} from 'react-router/lib/Router';
import * as Sentry from '@sentry/react';
import {Location} from 'history';

import * as DividerHandlerManager from 'app/components/events/interfaces/spans/dividerHandlerManager';
import * as Layout from 'app/components/layouts/thirds';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import {t, tn} from 'app/locale';
import {Organization} from 'app/types';
import {TraceFull} from 'app/utils/performance/quickTrace/types';
import Breadcrumb from 'app/views/performance/breadcrumb';
import {MetaData} from 'app/views/performance/transactionDetails/styles';

import {
  StyledPanel,
  TraceDetailBody,
  TraceDetailHeader,
  TraceViewContainer,
} from './styles';
import TransactionGroup from './transactionGroup';
import {TraceInfo} from './types';
import {getTraceInfo} from './utils';

type AccType = {
  renderedChildren: React.ReactNode[];
  lastIndex: number;
};

type Props = {
  location: Location;
  organization: Organization;
  params: Params;
  traceSlug: string;
  start: string | undefined;
  end: string | undefined;
  statsPeriod: string | undefined;
  isLoading: boolean;
  error: string | null;
  trace: TraceFull | null;
};

class TraceDetailsContent extends React.Component<Props> {
  traceViewRef = React.createRef<HTMLDivElement>();

  renderTraceLoading() {
    return <LoadingIndicator />;
  }

  renderTraceRequiresDateRangeSelection() {
    return <LoadingError message={t('Trace view requires a date range selection.')} />;
  }

  renderTraceNotFound() {
    return <LoadingError message={t('The trace you are looking for was not found.')} />;
  }

  renderTraceHeader(traceInfo: TraceInfo) {
    return (
      <TraceDetailHeader>
        <MetaData
          headingText={t('Transactions')}
          tooltipText={t('All the transactions that are a part of this trace.')}
          bodyText={t(
            '%s of %s',
            traceInfo.transactions.size,
            traceInfo.transactions.size
          )}
          subtext={tn(
            'Across %s project',
            'Across %s projects',
            traceInfo.relevantProjectsWithTransactions.size
          )}
        />
        <MetaData
          headingText={t('Errors')}
          tooltipText={t('All the errors that are a part of this trace.')}
          bodyText={t('%s of %s', traceInfo.errors.size, traceInfo.errors.size)}
          subtext={tn(
            'Across %s project',
            'Across %s projects',
            traceInfo.relevantProjectsWithErrors.size
          )}
        />
      </TraceDetailHeader>
    );
  }

  renderTransaction(
    transaction: TraceFull,
    {
      continuingDepths,
      isLast,
      index,
      traceInfo,
    }: {
      continuingDepths: number[];
      isLast: boolean;
      index: number;
      traceInfo: TraceInfo;
    }
  ) {
    const accumulated: AccType = transaction.children.reduce(
      (acc: AccType, child: TraceFull, idx: number) => {
        const isLastChild = idx === transaction.children.length - 1;
        const hasChildren = child.children.length > 0;

        const result = this.renderTransaction(child, {
          continuingDepths:
            !isLastChild && hasChildren
              ? [...continuingDepths, transaction.generation]
              : continuingDepths,
          isLast: isLastChild,
          index: acc.lastIndex + 1,
          traceInfo,
        });

        acc.lastIndex = result.lastIndex;
        acc.renderedChildren.push(result.transactionGroup);

        return acc;
      },
      {
        renderedChildren: [],
        lastIndex: index,
      }
    );

    return {
      transactionGroup: (
        <TransactionGroup
          key={transaction.event_id}
          traceInfo={traceInfo}
          transaction={transaction}
          continuingDepths={continuingDepths}
          isLast={isLast}
          index={index}
          isVisible
          renderedChildren={accumulated.renderedChildren}
        />
      ),
      lastIndex: accumulated.lastIndex,
    };
  }

  renderTraceView(traceInfo: TraceInfo) {
    const {trace} = this.props;

    if (trace === null) {
      return this.renderTraceNotFound();
    }

    const {transactionGroup} = this.renderTransaction(trace, {
      continuingDepths: [],
      isLast: true,
      index: 0,
      traceInfo,
    });

    return (
      <TraceDetailBody>
        <StyledPanel>
          <DividerHandlerManager.Provider interactiveLayerRef={this.traceViewRef}>
            <TraceViewContainer ref={this.traceViewRef}>
              {transactionGroup}
            </TraceViewContainer>
          </DividerHandlerManager.Provider>
        </StyledPanel>
      </TraceDetailBody>
    );
  }

  renderContent() {
    const {traceSlug, start, end, statsPeriod, isLoading, error, trace} = this.props;

    if (!statsPeriod && (!start || !end)) {
      Sentry.setTag('current.trace_id', traceSlug);
      Sentry.captureException(new Error('No date range selection found.'));
      return this.renderTraceRequiresDateRangeSelection();
    } else if (isLoading) {
      return this.renderTraceLoading();
    } else if (error !== null || trace === null) {
      return this.renderTraceNotFound();
    } else {
      const traceInfo = getTraceInfo(trace);
      return (
        <React.Fragment>
          {this.renderTraceHeader(traceInfo)}
          {this.renderTraceView(traceInfo)}
        </React.Fragment>
      );
    }
  }

  render() {
    const {organization, location, traceSlug} = this.props;

    return (
      <React.Fragment>
        <Layout.Header>
          <Layout.HeaderContent>
            <Breadcrumb
              organization={organization}
              location={location}
              traceSlug={traceSlug}
            />
            <Layout.Title data-test-id="trace-header">
              {t('Trace Id: %s', traceSlug)}
            </Layout.Title>
          </Layout.HeaderContent>
        </Layout.Header>
        <Layout.Body>
          <Layout.Main fullWidth>{this.renderContent()}</Layout.Main>
        </Layout.Body>
      </React.Fragment>
    );
  }
}

export default TraceDetailsContent;
