import {Component} from 'react';
import styled from '@emotion/styled';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import Button from 'sentry/components/button';
import TextCopyInput from 'sentry/components/forms/textCopyInput';

type Props = {
  closeModal: () => void;
  installationId: string;
};

/**
 * This component is a hack for Split.
 * It will display the installation ID after installation so users can copy it and paste it in Split's website.
 * We also have a link for users to click so they can go to Split's website.
 */
export default class SplitInstallationIdModal extends Component<Props> {
  onCopy = async () =>
    // This hack is needed because the normal copying methods with TextCopyInput do not work correctly
    await navigator.clipboard.writeText(this.props.installationId);

  handleContinue = () => {
    const delay = 2000;
    this.onCopy();
    addSuccessMessage('Copied to clipboard');
    setTimeout(() => {
      window.open('https://app.split.io/org/admin/integrations');
    }, delay);
  };

  render() {
    const {installationId, closeModal} = this.props;
    // no need to translate this temporary component
    return (
      <div>
        <ItemHolder>
          Copy this Installation ID and click to continue. You will use it to finish setup
          on Split.io.
        </ItemHolder>
        <ItemHolder>
          <TextCopyInput onCopy={this.onCopy}>{installationId}</TextCopyInput>
        </ItemHolder>
        <ButtonHolder>
          <Button size="small" onClick={closeModal}>
            Close
          </Button>
          <Button size="small" priority="primary" onClick={this.handleContinue}>
            Copy and Open Link
          </Button>
        </ButtonHolder>
      </div>
    );
  }
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
