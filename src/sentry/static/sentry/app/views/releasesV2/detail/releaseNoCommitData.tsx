import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import space from 'app/styles/space';
import Button from 'app/components/button';
import Well from 'app/components/well';
import {IconCommit} from 'app/icons';

type Props = {
  orgId: string;
};

const ReleaseNoCommitData = ({orgId}: Props) => (
  <StyledWell centered>
    <IconCommit size="54px" />
    <h4>{t('Releases are better with commit data!')}</h4>
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

  svg {
    fill: ${p => p.theme.gray400};
  }
`;

export default ReleaseNoCommitData;
