import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import Button from 'app/components/button';

import TextCopyInput from 'app/views/settings/components/forms/textCopyInput';
import ExternalLink from 'app/components/links/externalLink';

/**
 * This component is a short term hack for Split.
 * It will display the installation ID after installation so users can copy it and paste it in Split's website.
 * We also have a link for users to click so they can go to Split's website.
 */
export default class SplitInstallationIdModal extends React.Component {
  static propTypes = {
    installationId: PropTypes.string.isRequired,
    closeModal: PropTypes.func.isRequired,
  };

  onCopy = async () => {
    //This hack is needed because the normal copying methods with TextCopyInput do not work correctly
    return await navigator.clipboard.writeText(this.props.installationId);
  };

  render() {
    const {installationId, closeModal} = this.props;
    //no need to translate this temporary component
    return (
      <div>
        <ItemHolder>
          Use this installation ID within Split. Log into Split and navigate to{' '}
          <code>Admin Settings</code> > <code>Integrations</code> >{' '}
          <code>select your desired workspace</code> > <code>Sentry</code>. There you will
          utilize this installation ID when configuring the integration. For more
          information, learn more in Split’s{' '}
          <ExternalLink href="https://help.split.io/hc/en-us/articles/360029879431-Sentry">
            integration documentation
          </ExternalLink>
          .
        </ItemHolder>
        <ItemHolder>
          <TextCopyInput onCopy={this.onCopy}>{installationId}</TextCopyInput>
        </ItemHolder>
        <ItemHolder>
          <ExternalLink href="https://app.split.io/admin/integrations">
            Click here to continue
          </ExternalLink>
        </ItemHolder>
        <ButtonHolder>
          <Button size="small" onClick={closeModal}>
            Close
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
`;
