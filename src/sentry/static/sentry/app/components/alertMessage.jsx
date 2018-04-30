import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import Alert from 'app/components/alert';
import AlertActions from 'app/actions/alertActions';
import InlineSvg from 'app/components/inlineSvg';
import {t} from 'app/locale';

const StyledAlert = styled(Alert)`
  padding: ${p => p.theme.grid}px ${p => p.theme.grid * 2}px;
  position: relative;
  margin: 0;
  padding-right: ${p => p.theme.grid * 4}px;
`;

const StyledInlineSvg = styled(InlineSvg)`
  /* Exists soley to enable its use as a selector in StyledCloseButton */
`;

const StyledCloseButton = styled.button`
  background: none;
  border: 0;
  opacity: 0.4;
  transition: opacity 0.2s linear;
  position: absolute;
  right: ${p => p.theme.grid}px;
  top: 7px;

  /* stylelint-disable-next-line no-duplicate-selectors */
  ${StyledInlineSvg} {
    color: ${p => p.theme.gray4};
  }

  &:hover {
    opacity: 0.8;
  }
`;

export default class AlertMessage extends React.PureComponent {
  static propTypes = {
    alert: PropTypes.shape({
      id: PropTypes.string,
      message: PropTypes.string.isRequired,
      type: PropTypes.oneOf(['success', 'error', 'warning', 'info']),
      url: PropTypes.string,
    }),
    system: PropTypes.bool,
  };

  closeAlert = () => {
    AlertActions.closeAlert(this.props.alert);
  };

  render = () => {
    let {alert, system} = this.props;
    let icon;

    if (alert.type == 'success') {
      icon = 'icon-circle-check';
    } else {
      icon = 'icon-circle-exclamation';
    }
    return (
      <StyledAlert type={this.props.alert.type} icon={icon} system={system}>
        <StyledCloseButton
          type="button"
          aria-label={t('Close')}
          onClick={this.closeAlert}
        >
          <StyledInlineSvg aria-hidden="true" src="icon-circle-close" />
        </StyledCloseButton>
        {this.props.alert.url ? (
          <a href={this.props.alert.url}>{this.props.alert.message}</a>
        ) : (
          this.props.alert.message
        )}
      </StyledAlert>
    );
  };
}
