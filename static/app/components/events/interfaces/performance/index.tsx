import styled from '@emotion/styled';

import {DataSection} from 'sentry/components/events/styles';
import {Group, Organization} from 'sentry/types';
import {useLocation} from 'sentry/utils/useLocation';

import {DurationChart} from './durationChart';
import {SpanCountChart} from './spanCountChart';
// import {SpanCountChart} from './spanCountChart';

interface Props {
  event: any;
  issue: Group;
  organization: Organization;
}

function BasePerformanceIssueSection({issue, event, organization}: Props) {
  const location = useLocation();

  return (
    <DataSection>
      <DurationChart
        issue={issue}
        event={event}
        location={location}
        organization={organization}
      />
      <SpanCountChart
        issue={issue}
        event={event}
        location={location}
        organization={organization}
      />
    </DataSection>
  );
}

export const PerformanceIssueSection = styled(BasePerformanceIssueSection)`
  display: flex;
  flex-direction: row;
`;
