import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import {withTheme} from 'emotion-theming';

import Alert from '../components/alert';
import AlertActions from '../actions/alertActions';
import InlineSvg from '../components/inlineSvg';
import {t} from '../locale';

const StyledAlert = withTheme(styled(Alert)`
  padding: ${p => p.theme.grid}px ${p => p.theme.grid * 2}px;
  position: relative;
  margin: 0;
  padding-right: ${p => p.theme.grid * 4}px;
`);

const StyledInlineSvg = styled(InlineSvg)`
  /* Exists soley to enable its use as a selector in StyledCloseButton */
`;

const StyledCloseButton = withTheme(styled.button`
  background: none;
  border: 0;
  opacity: 0.4;
  transition: opacity 0.2s linear;
  position: absolute;
  right: ${p => p.theme.grid}px;
  top: 7px;

  ${StyledInlineSvg} {
    color: ${p => p.theme.gray4};
  }

  &:hover {
    opacity: 0.8;
  }
`);

export default class AlertMessage extends React.PureComponent {
  static propTypes = {
    alert: PropTypes.shape({
      id: PropTypes.string,
      message: PropTypes.string.isRequired,
      type: PropTypes.oneOf(['success', 'error', 'warning']),
      url: PropTypes.string,
    }),
  };

  closeAlert = () => {
    AlertActions.closeAlert(this.props.alert);
  };

  render = () => {
    let alert = this.props.alert;
    let icon;

    if (alert.type == 'success') {
      icon = 'icon-circle-check';
    } else if (alert.type == 'error' || alert.type == 'warning') {
      icon = 'icon-circle-exclamation';
    }
    return (
      <StyledAlert type={this.props.alert.type} icon={icon}>
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
