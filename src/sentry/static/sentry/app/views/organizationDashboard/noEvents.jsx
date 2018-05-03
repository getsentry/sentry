import React from 'react';
import styled from 'react-emotion';
import {Flex} from 'grid-emotion';

import {t} from 'app/locale';

export default class NoEvents extends React.Component {
  render() {
    return (
      <Container>
        <EmptyText align="center" justify="center">
          {t('No activity yet.')}
        </EmptyText>
      </Container>
    );
  }
}

const Container = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
`;

const EmptyText = styled(Flex)`
  margin-left: 4px;
  margin-right: 4px;
  height: 68px;
  color: ${p => p.theme.gray2};
`;
