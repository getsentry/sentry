import styled from '@emotion/styled';

import sentryLoader from 'sentry-images/sentry-loader.svg';

import {space} from 'sentry/styles/space';

type Props = {
  children?: React.ReactNode;
};

function LoadingTriangle({children}: Props) {
  return (
    <LoadingTriangleWrapper data-test-id="loading-indicator">
      <CircleBackground>
        <img src={sentryLoader} />
      </CircleBackground>
      {children && <div>{children}</div>}
    </LoadingTriangleWrapper>
  );
}

const LoadingTriangleWrapper = styled('div')`
  position: absolute;
  top: 50%;
  left: 50%;
  width: 500px;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${space(3)};
`;

const CircleBackground = styled('div')`
  height: 150px;
  width: 150px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${p => p.theme.surface300};
  border-radius: 50%;
`;

export default LoadingTriangle;
