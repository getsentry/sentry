import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';

import Alert from '../../../components/alert';

const PanelAlertWrapper = styled(Alert)`
  margin: ${p => p.theme.grid * -2 - 1}px ${p => p.theme.grid * -2 - 1}px
    ${p => p.theme.grid * 3}px;
`;

const PanelAlert = ({type, children}) => {
  return <PanelAlertWrapper type={type}>{children}</PanelAlertWrapper>;
};

PanelAlert.propTypes = {
  type: PropTypes.string,
};

export default PanelAlert;
