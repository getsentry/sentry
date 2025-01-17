import styled from '@emotion/styled';

import {Button, LinkButton} from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import EmptyMessage from 'sentry/components/emptyMessage';
import Panel from 'sentry/components/panels/panel';
import PanelAlert from 'sentry/components/panels/panelAlert';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelItem from 'sentry/components/panels/panelItem';
import {IconDownload, IconPrint} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

type Props = {
  codes: string[];
  isEnrolled: boolean;
  onRegenerateBackupCodes: () => void;
  className?: string;
};

function RecoveryCodes({className, isEnrolled, codes, onRegenerateBackupCodes}: Props) {
  const printCodes = () => {
    // @ts-ignore TS(7015): Element implicitly has an 'any' type because index... Remove this comment to see the full error message
    // eslint-disable-next-line dot-notation
    const iframe = window.frames['printable'];
    iframe.document.write(codes.join('<br>'));
    iframe.print();
    iframe.document.close();
  };

  if (!isEnrolled || !codes) {
    return null;
  }

  const formattedCodes = codes.join(' \n');

  return (
    <CodeContainer className={className}>
      <PanelHeader hasButtons>
        {t('Unused Codes')}

        <Actions>
          <CopyToClipboardButton text={formattedCodes} size="sm" />
          <Button size="sm" onClick={printCodes} aria-label={t('print')}>
            <IconPrint />
          </Button>
          <LinkButton
            size="sm"
            download="sentry-recovery-codes.txt"
            href={`data:text/plain;charset=utf-8,${formattedCodes}`}
            aria-label={t('download')}
            icon={<IconDownload />}
          />
          <Confirm
            onConfirm={onRegenerateBackupCodes}
            message={t(
              'Are you sure you want to regenerate recovery codes? Your old codes will no longer work.'
            )}
          >
            <Button priority="danger" size="sm">
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
      <iframe data-test-id="frame" name="printable" style={{display: 'none'}} />
    </CodeContainer>
  );
}

export default RecoveryCodes;

const CodeContainer = styled(Panel)`
  margin-top: ${space(4)};
`;

const Actions = styled('div')`
  display: grid;
  grid-auto-flow: column;
  gap: ${space(1)};
`;

const Code = styled(PanelItem)`
  font-family: ${p => p.theme.text.familyMono};
  padding: ${space(2)};
`;
