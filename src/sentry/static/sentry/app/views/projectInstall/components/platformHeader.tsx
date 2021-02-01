import React from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import {t} from 'app/locale';
import {PageHeader} from 'app/styles/organization';
import space from 'app/styles/space';

type Props = {
  title: string;
  gettingStartedLink: string;
  docsLink: string;
};
export default function PlatformHeader({title, gettingStartedLink, docsLink}: Props) {
  return (
    <StyledPageHeader>
      <h2>{title}</h2>
      <ButtonBar gap={1}>
        <Button size="small" to={gettingStartedLink}>
          {t('< Back')}
        </Button>
        <Button size="small" href={docsLink} external>
          {t('Full Documentation')}
        </Button>
      </ButtonBar>
    </StyledPageHeader>
  );
}

const StyledPageHeader = styled(PageHeader)`
  margin-bottom: ${space(3)};

  h2 {
    margin: 0;
  }

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    flex-direction: column;
    align-items: flex-start;

    h2 {
      margin-bottom: ${space(2)};
    }
  }
`;
