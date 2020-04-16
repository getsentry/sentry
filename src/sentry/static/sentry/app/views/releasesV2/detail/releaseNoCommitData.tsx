import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import space from 'app/styles/space';
import Button from 'app/components/button';
import Well from 'app/components/well';
import {IconCommit} from 'app/icons/iconCommit';

type Props = {
  orgId: string;
};

const ReleaseNoCommitData = ({orgId}: Props) => (
  <StyledWell centered>
    <IconCommit size="xl" />
    <h5>{t('Releases are better with commit data!')}</h5>
    <p>
      {t(
        'Connect a repository to see commit info, files changed, and authors involved in future releases.'
      )}
    </p>
    <Button priority="primary" to={`/settings/${orgId}/repos/`}>
      {t('Connect a repository')}
    </Button>
  </StyledWell>
);

const StyledWell = styled(Well)`
  background-color: ${p => p.theme.white};
  padding-top: ${space(2)};
  padding-bottom: ${space(4)};
`;

export default ReleaseNoCommitData;
