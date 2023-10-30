import {Component, Fragment} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';
import omit from 'lodash/omit';

import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import DateTime from 'sentry/components/dateTime';
import {getFormattedTimeRangeWithLeadingAndTrailingZero} from 'sentry/components/events/interfaces/spans/utils';
import Link from 'sentry/components/links/link';
import {
  ErrorDot,
  ErrorLevel,
  ErrorMessageContent,
  ErrorMessageTitle,
  ErrorTitle,
} from 'sentry/components/performance/waterfall/rowDetails';
import {generateIssueEventTarget} from 'sentry/components/quickTrace/utils';
import {PAGE_URL_PARAM} from 'sentry/constants/pageFilters';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import {generateEventSlug} from 'sentry/utils/discover/urls';
import getDynamicText from 'sentry/utils/getDynamicText';
import {TraceFullDetailed} from 'sentry/utils/performance/quickTrace/types';
import {getTransactionDetailsUrl} from 'sentry/utils/performance/urls';
import {WEB_VITAL_DETAILS} from 'sentry/utils/performance/vitals/constants';
import {CustomProfiler} from 'sentry/utils/performanceForSentry';
import {generateProfileFlamechartRoute} from 'sentry/utils/profiling/routes';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';

import {Row, Tags, TransactionDetails, TransactionDetailsContainer} from './styles';

type Props = {
  location: Location;
  organization: Organization;
  scrollIntoView: () => void;
  transaction: TraceFullDetailed;
};

class TransactionDetail extends Component<Props> {
  componentDidMount() {
    const {organization, transaction} = this.props;

    trackAnalytics('performance_views.trace_view.open_transaction_details', {
      organization,
      operation: transaction['transaction.op'],
      transaction: transaction.transaction,
    });
  }

  renderTransactionErrors() {
    const {organization, transaction} = this.props;
    const {errors, performance_issues} = transaction;

    if (errors.length + performance_issues.length === 0) {
      return null;
    }

    return (
      <Alert
        system
        type="error"
        expand={[...errors, ...performance_issues].map(error => (
          <ErrorMessageContent key={error.event_id}>
            <ErrorDot level={error.level} />
            <ErrorLevel>{error.level}</ErrorLevel>
            <ErrorTitle>
              <Link to={generateIssueEventTarget(error, organization)}>
                {error.title}
              </Link>
            </ErrorTitle>
          </ErrorMessageContent>
        ))}
      >
        <ErrorMessageTitle>
          {tn(
            '%s issue occurred in this transaction.',
            '%s issues occurred in this transaction.',
            errors.length + performance_issues.length
          )}
        </ErrorMessageTitle>
      </Alert>
    );
  }

  renderGoToTransactionButton() {
    const {location, organization, transaction} = this.props;

    const eventSlug = generateEventSlug({
      id: transaction.event_id,
      project: transaction.project_slug,
    });

    const target = getTransactionDetailsUrl(
      organization.slug,
      eventSlug,
      transaction.transaction,
      omit(location.query, Object.values(PAGE_URL_PARAM))
    );

    return (
      <StyledButton size="xs" to={target}>
        {t('View Event')}
      </StyledButton>
    );
  }

  renderGoToSummaryButton() {
    const {location, organization, transaction} = this.props;

    const target = transactionSummaryRouteWithQuery({
      orgSlug: organization.slug,
      transaction: transaction.transaction,
      query: omit(location.query, Object.values(PAGE_URL_PARAM)),
      projectID: String(transaction.project_id),
    });

    return (
      <StyledButton size="xs" to={target}>
        {t('View Summary')}
      </StyledButton>
    );
  }

  renderGoToProfileButton() {
    const {organization, transaction} = this.props;

    if (!transaction.profile_id) {
      return null;
    }

    const target = generateProfileFlamechartRoute({
      orgSlug: organization.slug,
      projectSlug: transaction.project_slug,
      profileId: transaction.profile_id,
    });

    function handleOnClick() {
      trackAnalytics('profiling_views.go_to_flamegraph', {
        organization,
        source: 'performance.trace_view',
      });
    }

    return (
      <StyledButton size="xs" to={target} onClick={handleOnClick}>
        {t('View Profile')}
      </StyledButton>
    );
  }

  renderMeasurements() {
    const {transaction} = this.props;
    const {measurements = {}} = transaction;

    const measurementKeys = Object.keys(measurements)
      .filter(name => Boolean(WEB_VITAL_DETAILS[`measurements.${name}`]))
      .sort();

    if (measurementKeys.length <= 0) {
      return null;
    }

    return (
      <Fragment>
        {measurementKeys.map(measurement => (
          <Row
            key={measurement}
            title={WEB_VITAL_DETAILS[`measurements.${measurement}`]?.name}
          >
            {`${Number(measurements[measurement].value.toFixed(3)).toLocaleString()}ms`}
          </Row>
        ))}
      </Fragment>
    );
  }

  scrollBarIntoView =
    (transactionId: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
      // do not use the default anchor behaviour
      // because it will be hidden behind the minimap
      e.preventDefault();

      const hash = `#txn-${transactionId}`;

      this.props.scrollIntoView();

      // TODO(txiao): This is causing a rerender of the whole page,
      // which can be slow.
      //
      // make sure to update the location
      browserHistory.push({
        ...this.props.location,
        hash,
      });
    };

  renderTransactionDetail() {
    const {location, organization, transaction} = this.props;
    const startTimestamp = Math.min(transaction.start_timestamp, transaction.timestamp);
    const endTimestamp = Math.max(transaction.start_timestamp, transaction.timestamp);
    const {start: startTimeWithLeadingZero, end: endTimeWithLeadingZero} =
      getFormattedTimeRangeWithLeadingAndTrailingZero(startTimestamp, endTimestamp);
    const duration = (endTimestamp - startTimestamp) * 1000;
    const durationString = `${Number(duration.toFixed(3)).toLocaleString()}ms`;

    return (
      <TransactionDetails>
        <table className="table key-value">
          <tbody>
            <Row
              title={
                <TransactionIdTitle
                  onClick={this.scrollBarIntoView(transaction.event_id)}
                >
                  {t('Event ID')}
                </TransactionIdTitle>
              }
              extra={this.renderGoToTransactionButton()}
            >
              {transaction.event_id}
              <CopyToClipboardButton
                borderless
                size="zero"
                iconSize="xs"
                text={`${window.location.href.replace(window.location.hash, '')}#txn-${
                  transaction.event_id
                }`}
              />
            </Row>
            <Row title="Transaction" extra={this.renderGoToSummaryButton()}>
              {transaction.transaction}
            </Row>
            <Row title="Transaction Status">{transaction['transaction.status']}</Row>
            <Row title="Span ID">{transaction.span_id}</Row>
            {transaction.profile_id && (
              <Row title="Profile ID" extra={this.renderGoToProfileButton()}>
                {transaction.profile_id}
              </Row>
            )}
            <Row title="Project">{transaction.project_slug}</Row>
            <Row title="Start Date">
              {getDynamicText({
                fixed: 'Mar 19, 2021 11:06:27 AM UTC',
                value: (
                  <Fragment>
                    <DateTime date={startTimestamp * 1000} />
                    {` (${startTimeWithLeadingZero})`}
                  </Fragment>
                ),
              })}
            </Row>
            <Row title="End Date">
              {getDynamicText({
                fixed: 'Mar 19, 2021 11:06:28 AM UTC',
                value: (
                  <Fragment>
                    <DateTime date={endTimestamp * 1000} />
                    {` (${endTimeWithLeadingZero})`}
                  </Fragment>
                ),
              })}
            </Row>
            <Row title="Duration">{durationString}</Row>
            <Row title="Operation">{transaction['transaction.op'] || ''}</Row>
            {this.renderMeasurements()}
            <Tags
              location={location}
              organization={organization}
              transaction={transaction}
            />
          </tbody>
        </table>
      </TransactionDetails>
    );
  }

  render() {
    return (
      <CustomProfiler id="TransactionDetail">
        <TransactionDetailsContainer
          onClick={event => {
            // prevent toggling the transaction detail
            event.stopPropagation();
          }}
        >
          {this.renderTransactionErrors()}
          {this.renderTransactionDetail()}
        </TransactionDetailsContainer>
      </CustomProfiler>
    );
  }
}

const TransactionIdTitle = styled('a')`
  display: flex;
  color: ${p => p.theme.textColor};
  :hover {
    color: ${p => p.theme.textColor};
  }
`;

const StyledButton = styled(Button)`
  position: absolute;
  top: ${space(0.75)};
  right: ${space(0.5)};
`;

export default TransactionDetail;
