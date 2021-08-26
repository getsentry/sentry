import styled from '@emotion/styled';

import Button from 'app/components/button';
import Clipboard from 'app/components/clipboard';
import Confirm from 'app/components/confirm';
import {
  Panel,
  PanelAlert,
  PanelBody,
  PanelHeader,
  PanelItem,
} from 'app/components/panels';
import {IconCopy, IconDownload, IconPrint} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import EmptyMessage from 'app/views/settings/components/emptyMessage';

type Props = {
  isEnrolled: boolean;
  codes: string[];
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
            <Button size="small" label={t('copy')}>
              <IconCopy />
            </Button>
          </Clipboard>
          <Button size="small" onClick={printCodes} label={t('print')}>
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
            onConfirm={onRegenerateBackupCodes}
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
      <iframe name="printable" style={{display: 'none'}} />
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
  grid-gap: ${space(1)};
`;

const Code = styled(PanelItem)`
  font-family: ${p => p.theme.text.familyMono};
  padding: ${space(2)};
`;
