import {useCallback, useEffect, useRef} from 'react';
import styled from '@emotion/styled';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/button';
import TextCopyInput from 'sentry/components/textCopyInput';

type Props = {
  closeModal: () => void;
  installationId: string;
};

/**
 * This component is a hack for Split.
 * It will display the installation ID after installation so users can copy it and paste it in Split's website.
 * We also have a link for users to click so they can go to Split's website.
 */
export function SplitInstallationIdModal(props: Props) {
  const openAdminIntegrationTimeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    return () => {
      window.clearTimeout(openAdminIntegrationTimeoutRef.current);
    };
  }, []);

  const onCopy = useCallback(async () => {
    // This hack is needed because the normal copying methods with TextCopyInput do not work correctly
    await navigator.clipboard.writeText(props.installationId);
  }, [props.installationId]);

  const handleContinue = useCallback(() => {
    onCopy();
    addSuccessMessage('Copied to clipboard');

    window.clearTimeout(openAdminIntegrationTimeoutRef.current);

    openAdminIntegrationTimeoutRef.current = window.setTimeout(() => {
      window.open('https://app.split.io/org/admin/integrations');
    }, 2000);
  }, [onCopy]);

  // no need to translate this temporary component
  return (
    <div>
      <ItemHolder>
        Copy this Installation ID and click to continue. You will use it to finish setup
        on Split.io.
      </ItemHolder>
      <ItemHolder>
        <TextCopyInput onCopy={onCopy}>{props.installationId}</TextCopyInput>
      </ItemHolder>
      <ButtonHolder>
        <Button size="sm" onClick={props.closeModal}>
          Close
        </Button>
        <Button size="sm" priority="primary" onClick={handleContinue}>
          Copy and Open Link
        </Button>
      </ButtonHolder>
    </div>
  );
}

const ItemHolder = styled('div')`
  margin: 10px;
`;

const ButtonHolder = styled(ItemHolder)`
  text-align: right;
  & button {
    margin: 5px;
  }
`;
