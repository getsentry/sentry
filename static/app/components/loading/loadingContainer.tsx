import styled from '@emotion/styled';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import theme from 'sentry/utils/theme';

const defaultProps = {
  isLoading: false,
  isReloading: false,
  maskBackgroundColor: theme.white,
};

type DefaultProps = Readonly<typeof defaultProps>;

type Props = {
  children?: React.ReactNode;
  className?: string;
} & DefaultProps;

type MaskProps = {
  isReloading: boolean;
  maskBackgroundColor: string;
};

export default function LoadingContainer(props: Props) {
  const {className, children, isReloading, isLoading, maskBackgroundColor} = props;
  const isLoadingOrReloading = isLoading || isReloading;

  return (
    <Container className={className}>
      {isLoadingOrReloading && (
        <div>
          <LoadingMask
            isReloading={isReloading}
            maskBackgroundColor={maskBackgroundColor}
          />
          <Indicator />
        </div>
      )}
      {children}
    </Container>
  );
}

LoadingContainer.defaultProps = defaultProps;

const Container = styled('div')`
  position: relative;
`;

const LoadingMask = styled('div')<MaskProps>`
  position: absolute;
  z-index: 1;
  background-color: ${p => p.maskBackgroundColor};
  width: 100%;
  height: 100%;
  opacity: ${p => (p.isReloading ? '0.6' : '1')};
`;

const Indicator = styled(LoadingIndicator)`
  position: absolute;
  z-index: 3;
  width: 100%;
`;
