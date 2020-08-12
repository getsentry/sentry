import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';
import {Params} from 'react-router/lib/Router';

import {t} from 'app/locale';
import space from 'app/styles/space';
import {Event, Organization} from 'app/types';
import Link from 'app/components/links/link';
import {getHumanDuration, parseTrace} from 'app/components/events/interfaces/spans/utils';

import {getTransactionDetailsUrl} from '../utils';
import {isTransactionEvent} from './utils';

type Props = {
  organization: Organization;
  location: Location;
  params: Params;
  baselineEvent: Event;
  regressionEvent: Event;
};

class TransactionSummary extends React.Component<Props> {
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
                    organization,
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
              <ContentTitle>{t('Regressive Event')}</ContentTitle>
              <EventId>
                <span>{t('ID')}: </span>
                <StyledLink
                  to={getTransactionDetailsUrl(
                    organization,
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
  background-color: ${p => p.theme.gray700};
  height: 100%;
  width: 4px;

  margin-right: ${space(1)};
`;

const Regression = styled('div')`
  background-color: ${p => p.theme.purple300};
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
  color: ${p => p.theme.gray500};
`;

const StyledLink = styled(Link)`
  color: ${p => p.theme.gray500};
`;

function shortEventId(value: string): string {
  return value.substring(0, 8);
}

export default TransactionSummary;
