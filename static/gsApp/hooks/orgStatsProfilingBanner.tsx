import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import {IconShow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';

function OrgStatsProfilingBanner() {
  const location = useLocation();
  return (
    <BannerGrid>
      <HeaderItem>
        <h6>{t('Profiling has a new billing model!')}</h6>
        <span>
          {t(`
          We've split Profiling into two products targeted at different use cases –
          Continuous Profiling for the backend and UI Profiling for the frontend. These
          products are billed separately.
          `)}
        </span>
      </HeaderItem>
      <CategoryItemLeft>
        <h6>{t('UI Profile Hours')}</h6>
        <span>
          {t(`
          Ensure great UX on browser and mobile apps by fixing issues that cause long load
          times and unresponsive interactions.
          `)}
        </span>
        <div>
          <StyledProfilingButton
            size="sm"
            icon={<IconShow />}
            to={{
              ...location,
              query: {...location.query, dataCategory: 'profileDurationUI'},
            }}
          >
            {t('Go to UI Profile Hours')}
          </StyledProfilingButton>
        </div>
      </CategoryItemLeft>
      <CategoryItemRight>
        <h6>{t('Continuous Profile Hours')}</h6>
        <span>
          {t(`
          Find performance bottlenecks in backend services that cause high request latency
          and excessive infrastructure costs.
          `)}
        </span>
        <div>
          <StyledProfilingButton
            size="sm"
            icon={<IconShow />}
            to={{
              ...location,
              query: {...location.query, dataCategory: 'profileDuration'},
            }}
          >
            {t('Go to Continuous Profile Hours')}
          </StyledProfilingButton>
        </div>
      </CategoryItemRight>
    </BannerGrid>
  );
}

const BannerGrid = styled('div')`
  display: grid;
  grid-template-columns: 1fr;
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  margin-bottom: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    grid-template-columns: repeat(2, 1fr);
  }
  @media (min-width: ${p => p.theme.breakpoints.lg}) {
    grid-template-columns: repeat(3, 1fr);
  }
`;

const HeaderItem = styled('div')`
  grid-column: span 1;

  padding: ${space(2)};
  background-color: ${p => p.theme.tokens.background.secondary};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    grid-column: span 2;
    border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  }

  @media (min-width: ${p => p.theme.breakpoints.lg}) {
    grid-column: span 1;
    border-bottom: none;
  }
`;

const CategoryItemLeft = styled('div')`
  grid-column: span 1;
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  padding: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    border-right: 1px solid ${p => p.theme.tokens.border.primary};
    border-bottom: none;
  }
  @media (min-width: ${p => p.theme.breakpoints.lg}) {
    border-left: 1px solid ${p => p.theme.tokens.border.primary};
    border-right: 1px solid ${p => p.theme.tokens.border.primary};
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
