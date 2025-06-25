import styled from '@emotion/styled';

import {useCodecovContext} from 'sentry/components/codecov/context/codecovContext';
import {IntegratedOrgSelector} from 'sentry/components/codecov/integratedOrgSelector/integratedOrgSelector';
import {Button} from 'sentry/components/core/button';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

export default function TokensPage() {
  const {integratedOrg} = useCodecovContext();

  return (
    <LayoutGap>
      <PageFilterBar condensed>
        <IntegratedOrgSelector />
      </PageFilterBar>
      <HeaderValue>{t('Repository tokens')}</HeaderValue>
      <TopRow>
        <p>
          {t('View the list of tokens created for your repositories in')}{' '}
          <strong>{integratedOrg}</strong>.{' '}
          {t("Use them for uploading reports to all Sentry Prevent's features.")}
        </p>
        <StyledButton
          size="sm"
          priority="primary"
          onClick={() => {}}
          aria-label="regenerate token"
        >
          Regenerate token
        </StyledButton>
      </TopRow>
    </LayoutGap>
  );
}

const LayoutGap = styled('div')`
  display: grid;
  gap: ${space(1)};
  max-width: 1200px;
`;

const HeaderValue = styled('div')`
  margin-top: ${space(4)};
  font-size: ${p => p.theme.headerFontSize};
  font-weight: ${p => p.theme.fontWeightBold};
`;

const StyledButton = styled(Button)`
  max-width: 175px;
`;

const TopRow = styled('div')`
  display: flex;
  justify-content: space-between;
`;
