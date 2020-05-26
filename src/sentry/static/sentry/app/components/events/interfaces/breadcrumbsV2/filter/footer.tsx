import React from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import {growIn} from 'app/styles/animations';
import space from 'app/styles/space';
import {t} from 'app/locale';

type Props = {
  onSubmit: () => void;
};

const Footer = ({onSubmit}: Props) => (
  <Wrapper>
    <ApplyFilterButton onClick={onSubmit} size="xsmall" priority="primary">
      {t('Apply Filter')}
    </ApplyFilterButton>
  </Wrapper>
);

const Wrapper = styled('div')`
  display: flex;
  justify-content: flex-end;
  background-color: ${p => p.theme.offWhite};
  padding: ${space(1)};
`;

const ApplyFilterButton = styled(Button)`
  animation: 0.1s ${growIn} ease-in;
  margin: ${space(0.5)} 0;
`;

export {Footer};
