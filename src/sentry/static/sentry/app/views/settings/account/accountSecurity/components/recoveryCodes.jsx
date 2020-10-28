import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {
  Panel,
  PanelBody,
  PanelHeader,
  PanelItem,
  PanelAlert,
} from 'app/components/panels';
import {t} from 'app/locale';
import Button from 'app/components/button';
import Clipboard from 'app/components/clipboard';
import Confirm from 'app/components/confirm';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import {IconCopy, IconDownload, IconPrint} from 'app/icons';
import space from 'app/styles/space';

class RecoveryCodes extends React.Component {
  static propTypes = {
    isEnrolled: PropTypes.bool,
    codes: PropTypes.arrayOf(PropTypes.string),
    onRegenerateBackupCodes: PropTypes.func.isRequired,
  };

  printCodes = () => {
    const iframe = window.frames.printable;
    iframe.document.write(this.props.codes.join('<br>'));
    iframe.print();
    iframe.document.close();
  };

  render() {
    const {className, isEnrolled, codes} = this.props;

    if (!isEnrolled || !codes) {
      return null;
    }

    const formattedCodes = codes.join(' \n');

    return (
      <Panel className={className}>
        <PanelHeader hasButtons>
          {t('Unused Codes')}

          <Actions>
            <Clipboard hideUnsupported value={formattedCodes}>
              <Button size="small" label={t('copy')}>
                <IconCopy />
              </Button>
            </Clipboard>
            <Button size="small" onClick={this.printCodes} label={t('print')}>
              <IconPrint />
            </Button>
            <Button
              size="small"
              download="sentry-recovery-codes.txt"
              href={`data:text/plain;charset=utf-8,${formattedCodes}`}
              label={t('download')}
            >
              <IconDownload />
            </Button>
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
          </Actions>
        </PanelHeader>
        <PanelBody>
          <PanelAlert type="warning">
            {t(
              'Make sure to save a copy of your recovery codes and store them in a safe place.'
            )}
          </PanelAlert>
          <div>{!!codes.length && codes.map(code => <Code key={code}>{code}</Code>)}</div>
          {!codes.length && (
            <EmptyMessage>{t('You have no more recovery codes to use')}</EmptyMessage>
          )}
        </PanelBody>
        <iframe name="printable" css={{display: 'none'}} />
      </Panel>
    );
  }
}

export default styled(RecoveryCodes)`
  margin-top: ${space(4)};
`;

const Actions = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-gap: ${space(1)};
`;

const Code = styled(PanelItem)`
  font-family: ${p => p.theme.text.familyMono};
  padding: ${space(2)};
`;
