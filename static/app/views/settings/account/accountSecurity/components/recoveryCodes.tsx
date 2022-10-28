import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import Clipboard from 'sentry/components/clipboard';
import Confirm from 'sentry/components/confirm';
import EmptyMessage from 'sentry/components/emptyMessage';
import {
  Panel,
  PanelAlert,
  PanelBody,
  PanelHeader,
  PanelItem,
} from 'sentry/components/panels';
import {IconCopy, IconDownload, IconPrint} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';

type Props = {
  codes: string[];
  isEnrolled: boolean;
  onRegenerateBackupCodes: () => void;
  className?: string;
};

const RecoveryCodes = ({
  className,
  isEnrolled,
  codes,
  onRegenerateBackupCodes,
}: Props) => {
  const printCodes = () => {
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
          <Clipboard hideUnsupported value={formattedCodes}>
            <Button size="sm" aria-label={t('copy')}>
              <IconCopy />
            </Button>
          </Clipboard>
          <Button size="sm" onClick={printCodes} aria-label={t('print')}>
            <IconPrint />
          </Button>
          <Button
            size="sm"
            download="sentry-recovery-codes.txt"
            href={`data:text/plain;charset=utf-8,${formattedCodes}`}
            aria-label={t('download')}
          >
            <IconDownload />
          </Button>
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
};

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
