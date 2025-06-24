import styled from '@emotion/styled';

import {IntegratedOrgSelector} from 'sentry/components/codecov/integratedOrgSelector/integratedOrgSelector';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

export default function TokensPage() {
  return (
    <LayoutGap>
      <PageFilterBar condensed>
        <IntegratedOrgSelector />
      </PageFilterBar>
      <p>{t('Repository tokens')}</p>
      <p>
        {t(`View the list of tokens created for your repositories in Turing-Corp. Use them for
        uploading reports to all Sentry Prevent's features.`)}
      </p>
    </LayoutGap>
  );
}

const LayoutGap = styled('div')`
  display: grid;
  gap: ${space(2)};
`;
