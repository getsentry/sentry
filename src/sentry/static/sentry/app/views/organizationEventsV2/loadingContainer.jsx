import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';

import LoadingIndicator from 'app/components/loadingIndicator';

export default function LoadingContainer(props) {
  const {children, hasResults, isLoading} = props;

  return (
    <div>
      {isLoading && (
        <div>
          <LoadingMask hasResults={hasResults} />
          <Indicator />
        </div>
      )}
      {children}
    </div>
  );
}

LoadingContainer.propTypes = {
  isLoading: PropTypes.bool.isRequired,
  hasResults: PropTypes.bool.isRequired,
  children: PropTypes.node,
};

const LoadingMask = styled('div')`
  position: absolute;
  z-index: 1;
  background-color: ${p => p.theme.white};
  width: 100%;
  height: 100%;
  min-height: 240px;
  opacity: ${p => (p.hasResults ? '0.6' : '1')};
`;

const Indicator = styled(LoadingIndicator)`
  position: absolute;
  z-index: 3;
  width: 100%;
`;
