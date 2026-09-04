import {useRef} from 'react';
import styled from '@emotion/styled';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Grid} from '@sentry/scraps/layout';

import {Confirm} from 'sentry/components/confirm';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {EmptyMessage} from 'sentry/components/emptyMessage';
import {Panel} from 'sentry/components/panels/panel';
import {PanelAlert} from 'sentry/components/panels/panelAlert';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {PanelItem} from 'sentry/components/panels/panelItem';
import {IconDownload, IconPrint} from 'sentry/icons';
import {t} from 'sentry/locale';

type Props = {
  codes: string[];
  isEnrolled: boolean;
  onRegenerateBackupCodes: () => void;
  className?: string;
};

export function RecoveryCodes({
  className,
  isEnrolled,
  codes,
  onRegenerateBackupCodes,
}: Props) {
  const printRef = useRef<HTMLIFrameElement>(null);

  const printCodes = () => {
    const doc = printRef.current?.contentDocument;
    if (!doc) {
      return;
    }

    doc.body.replaceChildren(
      ...codes.map(code => Object.assign(doc.createElement('div'), {textContent: code}))
    );

    printRef.current?.contentWindow?.print();
  };

  if (!isEnrolled || !codes) {
    return null;
  }

  const formattedCodes = codes.join(' \n');

  return (
    <CodeContainer className={className}>
      <PanelHeader hasButtons>
        {t('Unused Codes')}

        <Grid flow="column" align="center" gap="md">
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
            <Button variant="danger" size="xs">
              {t('Regenerate Codes')}
            </Button>
          </Confirm>
        </Grid>
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
      <iframe ref={printRef} data-test-id="frame" style={{display: 'none'}} />
    </CodeContainer>
  );
}

const CodeContainer = styled(Panel)`
  margin-top: ${p => p.theme.space['3xl']};
`;

const Code = styled(PanelItem)`
  font-family: ${p => p.theme.font.family.mono};
  padding: ${p => p.theme.space.xl};
`;
