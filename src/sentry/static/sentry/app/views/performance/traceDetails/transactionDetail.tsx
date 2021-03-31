import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import Alert from 'app/components/alert';
import Button from 'app/components/button';
import DateTime from 'app/components/dateTime';
import {getTraceDateTimeRange} from 'app/components/events/interfaces/spans/utils';
import Link from 'app/components/links/link';
import {ALL_ACCESS_PROJECTS} from 'app/constants/globalSelectionHeader';
import {IconWarning} from 'app/icons';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import {eventDetailsRoute, generateEventSlug} from 'app/utils/discover/urls';
import getDynamicText from 'app/utils/getDynamicText';
import {TraceError, TraceFullDetailed} from 'app/utils/performance/quickTrace/types';
import {WEB_VITAL_DETAILS} from 'app/utils/performance/vitals/constants';
import {QueryResults, stringifyQueryObject} from 'app/utils/tokenizeSearch';
import {transactionSummaryRouteWithQuery} from 'app/views/performance/transactionSummary/utils';
import {getTransactionDetailsUrl} from 'app/views/performance/utils';

import {Row, Tags, TransactionDetails, TransactionDetailsContainer} from './styles';

type Props = {
  location: Location;
  organization: Organization;
  transaction: TraceFullDetailed;
};

class TransactionDetail extends React.Component<Props> {
  renderSingleErrorMessage(error: TraceError) {
    const {organization} = this.props;

    const eventSlug = generateEventSlug({
      id: error.event_id,
      project: error.project_slug,
    });

    const target = {
      pathname: eventDetailsRoute({
        orgSlug: organization.slug,
        eventSlug,
      }),
    };

    return (
      <Link to={target}>
        <span>{t('An error event occurred in this transaction.')}</span>
      </Link>
    );
  }

  renderMultiErrorMessage(errors: TraceError[]) {
    const {organization, transaction} = this.props;

    const {start, end} = getTraceDateTimeRange({
      start: transaction.start_timestamp,
      end: transaction.timestamp,
    });

    const queryResults = new QueryResults([]);
    const eventIds = errors.map(child => child.event_id);
    for (let i = 0; i < eventIds.length; i++) {
      queryResults.addOp(i === 0 ? '(' : 'OR');
      queryResults.addQuery(`id:${eventIds[i]}`);
      if (i === eventIds.length - 1) {
        queryResults.addOp(')');
      }
    }

    const eventView = EventView.fromSavedQuery({
      id: undefined,
      name: `Errors events associated with transaction ${transaction.event_id}`,
      fields: ['title', 'project', 'issue', 'timestamp'],
      orderby: '-timestamp',
      query: stringifyQueryObject(queryResults),
      projects: organization.features.includes('global-views')
        ? [ALL_ACCESS_PROJECTS]
        : [...new Set(errors.map(error => error.project_id))],
      version: 2,
      start,
      end,
    });

    const target = eventView.getResultsViewUrlTarget(organization.slug);

    return (
      <div>
        {tct('[link] occured in this transaction.', {
          link: (
            <Link to={target}>
              <span>{t('%d error events', errors.length)}</span>
            </Link>
          ),
        })}
      </div>
    );
  }

  renderTransactionErrors() {
    const {transaction} = this.props;
    const {errors} = transaction;

    if (errors.length === 0) {
      return null;
    }

    const message =
      errors.length === 1
        ? this.renderSingleErrorMessage(errors[0])
        : this.renderMultiErrorMessage(errors);

    return (
      <Alert system type="error" icon={<IconWarning size="md" />}>
        {message}
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
      organization,
      eventSlug,
      transaction.transaction,
      location.query
    );

    return (
      <StyledButton size="xsmall" to={target}>
        {t('View Transaction')}
      </StyledButton>
    );
  }

  renderGoToSummaryButton() {
    const {location, organization, transaction} = this.props;

    const target = transactionSummaryRouteWithQuery({
      orgSlug: organization.slug,
      transaction: transaction.transaction,
      query: location.query,
      projectID: String(transaction.project_id),
    });

    return (
      <StyledButton size="xsmall" to={target}>
        {t('View Summary')}
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
      <React.Fragment>
        {measurementKeys.map(measurement => (
          <Row
            key={measurement}
            title={WEB_VITAL_DETAILS[`measurements.${measurement}`]?.name}
          >
            {`${Number(measurements[measurement].value.toFixed(3)).toLocaleString()}ms`}
          </Row>
        ))}
      </React.Fragment>
    );
  }

  renderTransactionDetail() {
    const {location, organization, transaction} = this.props;
    const startTimestamp = Math.min(transaction.start_timestamp, transaction.timestamp);
    const endTimestamp = Math.max(transaction.start_timestamp, transaction.timestamp);
    const duration = (endTimestamp - startTimestamp) * 1000;
    const durationString = `${Number(duration.toFixed(3)).toLocaleString()}ms`;

    return (
      <TransactionDetails>
        <table className="table key-value">
          <tbody>
            <Row title="Transaction ID" extra={this.renderGoToTransactionButton()}>
              {transaction.event_id}
            </Row>
            <Row title="Transaction" extra={this.renderGoToSummaryButton()}>
              {transaction.transaction}
            </Row>
            <Row title="Transaction Status">{transaction['transaction.status']}</Row>
            <Row title="Start Date">
              {getDynamicText({
                fixed: 'Mar 19, 2021 11:06:27 AM UTC',
                value: (
                  <React.Fragment>
                    <DateTime date={startTimestamp * 1000} />
                    {` (${startTimestamp})`}
                  </React.Fragment>
                ),
              })}
            </Row>
            <Row title="End Date">
              {getDynamicText({
                fixed: 'Mar 19, 2021 11:06:28 AM UTC',
                value: (
                  <React.Fragment>
                    <DateTime date={endTimestamp * 1000} />
                    {` (${endTimestamp})`}
                  </React.Fragment>
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
      <TransactionDetailsContainer
        onClick={event => {
          // prevent toggling the transaction detail
          event.stopPropagation();
        }}
      >
        {this.renderTransactionErrors()}
        {this.renderTransactionDetail()}
      </TransactionDetailsContainer>
    );
  }
}

const StyledButton = styled(Button)`
  position: absolute;
  top: ${space(0.75)};
  right: ${space(0.5)};
`;

export default TransactionDetail;
