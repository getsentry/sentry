import {Box, Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled, {css} from 'react-emotion';

import {t} from '../../../../../locale';
import Button from '../../../../../components/buttons/button';
import Confirm from '../../../../../components/confirm';
import EmptyMessage from '../../../components/emptyMessage';
import InlineSvg from '../../../../../components/inlineSvg';
import Panel from '../../../components/panel';
import PanelBody from '../../../components/panelBody';
import PanelHeader from '../../../components/panelHeader';
import PanelItem from '../../../components/panelItem';

const Code = styled(props => <PanelItem p={2} {...props} />)`
  font-family: ${p => p.theme.text.familyMono};
`;

const PanelWarning = styled(props => <Flex p={2} {...props} />)`
  ${p => css`
    background-color: ${p.theme.alert.warning.backgroundLight};
    border-bottom: 1px solid ${p.theme.borderLight};
    color: ${p.theme.alert.warning.textDark};
  `};
`;

class RecoveryCodes extends React.Component {
  static propTypes = {
    isEnrolled: PropTypes.bool,
    codes: PropTypes.arrayOf(PropTypes.string),
    onRegenerateBackupCodes: PropTypes.func.isRequired,
  };

  static defaultProps = {
    onRegenerateBackupCodes: () => {},
  };

  render() {
    let {isEnrolled, codes} = this.props;

    if (!isEnrolled || !codes) return null;

    return (
      <Panel css={{marginTop: 30}}>
        <PanelHeader>
          <Flex align="center">
            <Box flex="1">{t('Unused Codes')}</Box>
            <Confirm
              onConfirm={this.props.onRegenerateBackupCodes}
              message={t(
                'Are you sure you want to regenerate recovery codes? Your old codes will no longer work.'
              )}
            >
              <Button priority="danger" size="small">
                {t('Regenerate Codes')}
              </Button>
            </Confirm>
          </Flex>
        </PanelHeader>
        <PanelBody>
          <PanelWarning>
            <InlineSvg css={{fontSize: '2em'}} src="icon-warning-sm" />
            <Flex align="center" ml={2} flex="1">
              Make sure to keep a copy of these codes to recover your account if you lose
              your authenticator.
            </Flex>
          </PanelWarning>
          {!!codes.length && codes.map(code => <Code key={code}>{code}</Code>)}
          {!codes.length && (
            <EmptyMessage>{t('You have no more recovery codes to use')}</EmptyMessage>
          )}
        </PanelBody>
      </Panel>
    );
  }
}

export default RecoveryCodes;
