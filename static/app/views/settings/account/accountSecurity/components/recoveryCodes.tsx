import styled from '@emotion/styled';

import Confirm from 'sentry/components/confirm';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
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
    // @ts-expect-error TS(7015): Element implicitly has an 'any' type because index... Remove this comment to see the full error message
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

        <ButtonBar>
          <CopyToClipboardButton
            text={formattedCodes}
            aria-label={t('Copy recovery codes to clipboard')}
            size="xs"
          />
          <Button
            size="xs"
            onClick={printCodes}
            aria-label={t('print')}
            icon={<IconPrint />}
          />
          <LinkButton
            size="xs"
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
            <Button priority="danger" size="xs">
              {t('Regenerate Codes')}
            </Button>
          </Confirm>
        </ButtonBar>
      </PanelHeader>
      <PanelBody>
        <PanelAlert variant="warning">
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

const Code = styled(PanelItem)`
  font-family: ${p => p.theme.text.familyMono};
  padding: ${space(2)};
`;
