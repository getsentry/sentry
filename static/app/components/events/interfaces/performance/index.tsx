import styled from '@emotion/styled';

import Tooltip from 'sentry/components/tooltip';
import {IconQuestion} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {EventError, Group, Organization} from 'sentry/types';
import {useLocation} from 'sentry/utils/useLocation';

import {DurationChart} from './durationChart';
import {SlowDbSpanChangeBar, SpanChangeBar} from './spanChangeBar';
import {SpanCountChart} from './spanCountChart';

interface Props {
  event: EventError;
  issue: Group;
  organization: Organization;
}

export function PerformanceIssueSection({issue, event, organization}: Props) {
  const location = useLocation();

  return (
    <Wrapper>
      <Section>
        <h3>{t('P75 Duration Change')}</h3>
        <DurationChart
          issue={issue}
          location={location}
          organization={organization}
          event={event}
        />
      </Section>
      <Section>
        <SlowDbSpanChangeBar event={undefined} affectedSpanIds={[]} />
        {/* <h3>{t('Span Count Distribution')}</h3>
        <SpanCountChart
          issue={issue}
          event={event}
          location={location}
          organization={organization}
        /> */}
      </Section>
    </Wrapper>
  );
}

export const Wrapper = styled('div')`
  display: flex;
  flex-direction: row;
  border-top: 1px solid ${p => p.theme.innerBorder};
  margin: 0;
  /* Padding aligns with Layout.Body */
  padding: ${space(3)} ${space(2)} ${space(2)};
  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    padding: ${space(3)} ${space(4)} ${space(3)};
  }
  & h3,
  & h3 a {
    font-size: 14px;
    font-weight: 600;
    line-height: 1.2;
    color: ${p => p.theme.gray300};
  }
  & h3 {
    font-size: 14px;
    font-weight: 600;
    line-height: 1.2;
    padding: ${space(0.75)} 0;
    margin-bottom: 0;
    text-transform: uppercase;
  }
  div:first-child {
    margin-right: ${space(3)};
  }
`;

const Section = styled('div')`
  width: 50%;
`;
