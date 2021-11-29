import {Component} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {parseTrace} from 'sentry/components/events/interfaces/spans/utils';
import Link from 'sentry/components/links/link';
import {getHumanDuration} from 'sentry/components/performance/waterfall/utils';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {getTransactionDetailsUrl} from 'sentry/utils/performance/urls';

import {isTransactionEvent} from './utils';

type Props = Pick<
  RouteComponentProps<{baselineEventSlug: string; regressionEventSlug: string}, {}>,
  'location' | 'params'
> & {
  organization: Organization;
  baselineEvent: Event;
  regressionEvent: Event;
};

class TransactionSummary extends Component<Props> {
  render() {
    const {baselineEvent, regressionEvent, organization, location, params} = this.props;
    const {baselineEventSlug, regressionEventSlug} = params;

    if (!isTransactionEvent(baselineEvent) || !isTransactionEvent(regressionEvent)) {
      return null;
    }

    const baselineTrace = parseTrace(baselineEvent);
    const regressionTrace = parseTrace(regressionEvent);

    const baselineDuration = Math.abs(
      baselineTrace.traceStartTimestamp - baselineTrace.traceEndTimestamp
    );
    const regressionDuration = Math.abs(
      regressionTrace.traceStartTimestamp - regressionTrace.traceEndTimestamp
    );

    return (
      <Container>
        <EventRow>
          <Baseline />
          <EventRowContent>
            <Content>
              <ContentTitle>{t('Baseline Event')}</ContentTitle>
              <EventId>
                <span>{t('ID')}: </span>
                <StyledLink
                  to={getTransactionDetailsUrl(
                    organization.slug,
                    baselineEventSlug.trim(),
                    baselineEvent.title,
                    location.query
                  )}
                >
                  {shortEventId(baselineEvent.eventID)}
                </StyledLink>
              </EventId>
            </Content>
            <TimeDuration>
              <span>{getHumanDuration(baselineDuration)}</span>
            </TimeDuration>
          </EventRowContent>
        </EventRow>
        <EventRow>
          <Regression />
          <EventRowContent>
            <Content>
              <ContentTitle>{t('This Event')}</ContentTitle>
              <EventId>
                <span>{t('ID')}: </span>
                <StyledLink
                  to={getTransactionDetailsUrl(
                    organization.slug,
                    regressionEventSlug.trim(),
                    regressionEvent.title,
                    location.query
                  )}
                >
                  {shortEventId(regressionEvent.eventID)}
                </StyledLink>
              </EventId>
            </Content>
            <TimeDuration>
              <span>{getHumanDuration(regressionDuration)}</span>
            </TimeDuration>
          </EventRowContent>
        </EventRow>
      </Container>
    );
  }
}

const Container = styled('div')`
  display: flex;
  flex-direction: column;

  justify-content: space-between;
  align-content: space-between;

  padding-bottom: ${space(1)};

  > * + * {
    margin-top: ${space(0.75)};
  }
`;

const EventRow = styled('div')`
  display: flex;
`;

const Baseline = styled('div')`
  background-color: ${p => p.theme.textColor};
  height: 100%;
  width: 4px;

  margin-right: ${space(1)};
`;

const Regression = styled('div')`
  background-color: ${p => p.theme.purple200};
  height: 100%;
  width: 4px;

  margin-right: ${space(1)};
`;

const EventRowContent = styled('div')`
  flex-grow: 1;
  display: flex;
`;

const TimeDuration = styled('div')`
  display: flex;
  align-items: center;

  font-size: ${p => p.theme.headerFontSize};
  line-height: 1.2;

  margin-left: ${space(1)};
`;

const Content = styled('div')`
  flex-grow: 1;
  width: 150px;

  font-size: ${p => p.theme.fontSizeMedium};
`;

const ContentTitle = styled('div')`
  font-weight: 600;
`;

const EventId = styled('div')`
  color: ${p => p.theme.gray300};
`;

const StyledLink = styled(Link)`
  color: ${p => p.theme.gray300};
`;

function shortEventId(value: string): string {
  return value.substring(0, 8);
}

export default TransactionSummary;
