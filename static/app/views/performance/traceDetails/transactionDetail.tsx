import {Component} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';
import omit from 'lodash/omit';

import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {Alert} from 'sentry/components/core/alert';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Link} from 'sentry/components/core/link';
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
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {browserHistory} from 'sentry/utils/browserHistory';
import {generateEventSlug} from 'sentry/utils/discover/urls';
import type {TraceFullDetailed} from 'sentry/utils/performance/quickTrace/types';
import {getTransactionDetailsUrl} from 'sentry/utils/performance/urls';
import {WEB_VITAL_DETAILS} from 'sentry/utils/performance/vitals/constants';
import {CustomProfiler} from 'sentry/utils/performanceForSentry';
import {generateProfileFlamechartRoute} from 'sentry/utils/profiling/routes';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';

import {Tags} from './styles';

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
      <Alert.Container>
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
      </Alert.Container>
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
      <StyledLinkButton size="xs" to={target}>
        {t('View Event')}
      </StyledLinkButton>
    );
  }

  renderGoToSummaryButton() {
    const {location, organization, transaction} = this.props;

    const target = transactionSummaryRouteWithQuery({
      organization,
      transaction: transaction.transaction,
      query: omit(location.query, Object.values(PAGE_URL_PARAM)),
      projectID: String(transaction.project_id),
    });

    return (
      <StyledLinkButton size="xs" to={target}>
        {t('View Summary')}
      </StyledLinkButton>
    );
  }

  renderGoToProfileButton() {
    const {organization, transaction} = this.props;

    if (!transaction.profile_id) {
      return null;
    }

    const target = generateProfileFlamechartRoute({
      organization,
      projectSlug: transaction.project_slug,
      profileId: transaction.profile_id,
    });

    function handleOnClick() {
      trackAnalytics('profiling_views.go_to_flamegraph', {
        organization,
        source: 'performance.trace_view.details',
      });
    }

    return (
      <StyledLinkButton size="xs" to={target} onClick={handleOnClick}>
        {t('View Profile')}
      </StyledLinkButton>
    );
  }

  renderMeasurements() {
    const {transaction} = this.props;
    const {measurements = {}} = transaction;

    const measurementKeys = Object.keys(measurements)
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      .filter(name => Boolean(WEB_VITAL_DETAILS[`measurements.${name}`]))
      .sort();

    if (measurementKeys.length <= 0) {
      return null;
    }

    return null;
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

    return (
      <table className="table key-value">
        <tbody>
          {transaction.event_id}
          <CopyToClipboardButton
            borderless
            size="zero"
            iconSize="xs"
            text={`${window.location.href.replace(window.location.hash, '')}#txn-${
              transaction.event_id
            }`}
          />
          {transaction.transaction}
          {this.renderMeasurements()}
          <Tags
            location={location}
            organization={organization}
            tags={transaction.tags ?? []}
            event={transaction}
          />
        </tbody>
      </table>
    );
  }

  render() {
    return (
      <CustomProfiler id="TransactionDetail">
        {this.renderTransactionErrors()}
        {this.renderTransactionDetail()}
      </CustomProfiler>
    );
  }
}

const StyledLinkButton = styled(LinkButton)`
  position: absolute;
  top: ${space(0.75)};
  right: ${space(0.5)};
`;

export default TransactionDetail;
