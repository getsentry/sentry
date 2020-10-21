import { Component } from 'react';
import styled from '@emotion/styled';

import LoadingIndicator from 'app/components/loadingIndicator';

import {LoadingContainer} from '../styles';

export default class Loading extends Component {
  render() {
    return (
      <Background>
        <LoadingContainer>
          <LoadingIndicator />
        </LoadingContainer>
      </Background>
    );
  }
}

export const Background = styled('div')`
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background-color: rgba(250, 249, 251, 0.7);
`;
