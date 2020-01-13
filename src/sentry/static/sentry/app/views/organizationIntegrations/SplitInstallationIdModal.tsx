import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';
import Button from 'app/components/button';

import TextCopyInput from 'app/views/settings/components/forms/textCopyInput';
import IndicatorStore from 'app/stores/indicatorStore';

type Props = {
  installationId: string;
  closeModal: () => void;
};

/**
 * This component is a short term hack for Split.
 * It will display the installation ID after installation so users can copy it and paste it in Split's website.
 * We also have a link for users to click so they can go to Split's website.
 */
export default class SplitInstallationIdModal extends React.Component<Props> {
  static propTypes = {
    installationId: PropTypes.string.isRequired,
    closeModal: PropTypes.func.isRequired,
  };

  onCopy = async () => {
    //This hack is needed because the normal copying methods with TextCopyInput do not work correctly
    return await navigator.clipboard.writeText(this.props.installationId);
  };

  handleContinue = () => {
    const delay = 2000;
    this.onCopy();
    IndicatorStore.add('Copied to clipboard', 'success', {duration: delay});
    setTimeout(() => {
      window.open('https://app.split.io/org/admin/integrations');
    }, delay);
  };

  render() {
    const {installationId, closeModal} = this.props;
    //no need to translate this temporary component
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
