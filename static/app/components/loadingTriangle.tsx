import styled from '@emotion/styled';

import sentryLoader from 'sentry-images/sentry-loader.svg';

import {space} from 'sentry/styles/space';
import {useUser} from 'sentry/utils/useUser';

type Props = {
  children?: React.ReactNode;
};

function LoadingTriangle({children}: Props) {
  const user = useUser();
  return (
    <LoadingTriangleWrapper data-test-id="loading-indicator">
      <CircleBackground
        className={user?.options.theme ? `theme-${user.options.theme}` : ''}
      >
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
  background: #fff;
  border-radius: 50%;

  &.theme-dark {
    filter: invert(100%);
    opacity: 0.8;
  }
  &.theme-system {
    @media (prefers-color-scheme: dark) {
      filter: invert(100%);
      opacity: 0.8;
    }
  }
`;

export default LoadingTriangle;
