import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';

type Props = {
  seriesCount: number;
};

const NoEvents = ({seriesCount}: Props) => (
  <Container>
    <EmptyText seriesCount={seriesCount}>{t('No activity yet.')}</EmptyText>
  </Container>
);

export default NoEvents;

const Container = styled('div')`
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
`;

const EmptyText = styled('div')<Props>`
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 4px;
  margin-right: 4px;
  height: ${p => (p.seriesCount > 1 ? '90px' : '150px')};
  color: ${p => p.theme.gray500};
`;
