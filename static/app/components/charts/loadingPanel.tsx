import styled from '@emotion/styled';

import LoadingMask from 'sentry/components/loadingMask';

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * @default '200px'
   */
  height?: string;
}

const LoadingPanel = styled(({height: _height, ...props}: Props) => (
  <div {...props}>
    <LoadingMask />
  </div>
))`
  flex: 1;
  flex-shrink: 0;
  overflow: hidden;
  height: ${p => p.height ?? '200px'};
  position: relative;
  border-color: transparent;
  margin-bottom: 0;
`;

export default LoadingPanel;
