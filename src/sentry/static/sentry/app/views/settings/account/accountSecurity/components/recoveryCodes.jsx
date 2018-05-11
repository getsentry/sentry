import {Box, Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled, {css} from 'react-emotion';

import {t} from 'app/locale';
import Button from 'app/components/buttons/button';
import Clipboard from 'app/components/clipboard';
import Confirm from 'app/components/confirm';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import InlineSvg from 'app/components/inlineSvg';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';

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

  render() {
    let {isEnrolled, codes} = this.props;

    if (!isEnrolled || !codes) return null;

    let formattedCodes = codes.join('\n');

    let printCodes = () => {
      let iframe = window.frames.printable;
      iframe.document.write(codes.join('<br>'));
      iframe.print();
      iframe.document.close();
    };

    return (
      <Panel css={{marginTop: 30}}>
        <PanelHeader>
          <Flex align="center">
            <Box ml={2}>{t('Unused Codes')}</Box>
            <Box ml={3}>
              <Clipboard hideUnsupported value={formattedCodes}>
                <Button size="small">
                  <InlineSvg src="icon-copy" />
                </Button>
              </Clipboard>
            </Box>
            <Box ml={1}>
              <Button size="small" onClick={printCodes}>
                <InlineSvg src="icon-print" />
              </Button>
            </Box>
            <Box ml={1}>
              <Button
                size="small"
                download="sentry-recovery-codes.txt"
                href={`data:text/plain;charset=utf-8,${formattedCodes}`}
              >
                <InlineSvg src="icon-download" />
              </Button>
            </Box>
          </Flex>
          <Box ml={3}>
            <Confirm
              onConfirm={this.props.onRegenerateBackupCodes}
              message={t(
                'Are you sure you want to regenerate recovery codes? Your old codes will no longer work.'
              )}
            >
              <Button priority="danger" size="small" className="align-right">
                {t('Regenerate Codes')}
              </Button>
            </Confirm>
          </Box>
        </PanelHeader>
        <PanelBody>
          <PanelWarning>
            <InlineSvg css={{fontSize: '2em'}} src="icon-warning-sm" />
            <Flex align="center" ml={2} flex="1">
              {t(
                'Make sure to save a copy of your recovery codes and store them in a safe place.'
              )}
            </Flex>
          </PanelWarning>
          <Box>{!!codes.length && codes.map(code => <Code key={code}>{code}</Code>)}</Box>
          {!codes.length && (
            <EmptyMessage>{t('You have no more recovery codes to use')}</EmptyMessage>
          )}
        </PanelBody>
        <iframe name="printable" css={{display: 'none'}} />
      </Panel>
    );
  }
}

export default RecoveryCodes;
