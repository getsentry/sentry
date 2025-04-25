import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/core/button';
import {IconProfiling} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';

function OrgStatsProfilingBanner() {
  const location = useLocation();
  return (
    <BannerGrid>
      <HeaderItem>
        <h6>Profiling has a new billing model!</h6>
        <span>
          We've split Profiling into two products targeted at different use cases –
          Continuous Profiling for the backend and UI Profiling for the frontend. These
          products are billed separately.
        </span>
      </HeaderItem>
      <CategoryItemLeft>
        <h6>UI Profile Hours</h6>
        <span>
          Ensure great UX on browser and mobile apps by fixing issues that cause long load
          times and unresponsive interactions.
        </span>
        <div>
          <StyledProfilingButton
            size="sm"
            icon={<IconProfiling size="sm" />}
            title="Go to UI Profile Hours"
            aria-label="Go to UI Profile Hours"
            to={{
              ...location,
              query: {...location.query, dataCategory: 'profileDurationUI'},
            }}
          >
            Go to UI Profile Hours
          </StyledProfilingButton>
        </div>
      </CategoryItemLeft>
      <CategoryItemRight>
        <h6>Continuous Profile Hours</h6>
        <span>
          Find performance bottlenecks in backend services that cause high request latency
          and excessive infrastructure costs.
        </span>
        <div>
          <StyledProfilingButton
            size="sm"
            icon={<IconProfiling size="sm" />}
            title="Go to Continuous Profile Hours"
            aria-label="Go to Continuous Profile Hours"
            to={{
              ...location,
              query: {...location.query, dataCategory: 'profileDuration'},
            }}
          >
            Go to Continuous Profile Hours
          </StyledProfilingButton>
        </div>
      </CategoryItemRight>
    </BannerGrid>
  );
}

const BannerGrid = styled('div')`
  display: grid;
  grid-template-columns: 1fr;
  border: 1px solid ${p => p.theme.border};
  border-radius: 5px;
  margin-bottom: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    grid-template-columns: repeat(2, 1fr);
  }
  @media (min-width: ${p => p.theme.breakpoints.large}) {
    grid-template-columns: repeat(3, 1fr);
  }
`;

const HeaderItem = styled('div')`
  grid-column: span 1;

  padding: ${space(2)};
  background-color: ${p => p.theme.backgroundSecondary};
  border-bottom: 1px solid ${p => p.theme.border};

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    grid-column: span 2;
    border-bottom: 1px solid ${p => p.theme.border};
  }

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    grid-column: span 1;
    border-bottom: none;
  }
`;

const CategoryItemLeft = styled('div')`
  grid-column: span 1;
  border-bottom: 1px solid ${p => p.theme.border};
  padding: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    border-right: 1px solid ${p => p.theme.border};
    border-bottom: none;
  }
  @media (min-width: ${p => p.theme.breakpoints.large}) {
    border-left: 1px solid ${p => p.theme.border};
    border-right: 1px solid ${p => p.theme.border};
    border-bottom: none;
  }
`;

const CategoryItemRight = styled('div')`
  grid-column: span 1;
  padding: ${space(2)};
`;

const StyledProfilingButton = styled(LinkButton)`
  margin-top: ${space(1)};
`;

export default OrgStatsProfilingBanner;
