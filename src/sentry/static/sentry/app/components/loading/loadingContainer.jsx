import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';

import LoadingIndicator from 'app/components/loadingIndicator';

export default function LoadingContainer(props) {
  const {className, children, isReloading, isLoading} = props;

  const isLoadingOrReloading = isLoading || isReloading;

  return (
    <Container className={className}>
      {isLoadingOrReloading && (
        <div>
          <LoadingMask isReloading={isReloading} />
          <Indicator />
        </div>
      )}
      {children}
    </Container>
  );
}

LoadingContainer.propTypes = {
  isLoading: PropTypes.bool.isRequired,
  isReloading: PropTypes.bool.isRequired,
  children: PropTypes.node,
};

LoadingContainer.defaultProps = {
  isLoading: false,
  isReloading: false,
};

const Container = styled('div')`
  position: relative;
`;

const LoadingMask = styled('div')`
  position: absolute;
  z-index: 1;
  background-color: ${p => p.theme.white};
  width: 100%;
  height: 100%;
  opacity: ${p => (p.isReloading ? '0.6' : '1')};
`;

const Indicator = styled(LoadingIndicator)`
  position: absolute;
  z-index: 3;
  width: 100%;
`;
