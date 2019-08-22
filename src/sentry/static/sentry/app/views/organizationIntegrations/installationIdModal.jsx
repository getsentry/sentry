import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import Button from 'app/components/button';

import TextCopyInput from 'app/views/settings/components/forms/textCopyInput';
import ExternalLink from 'app/components/links/externalLink';
import {t} from 'app/locale';

/**
 * This component is a short term hack for Split.
 * It will display the installation ID after installation so users can copy it and paste it in Split's website.
 * We also have a link for users to click so they can go to Split's website.
 */
export default class InstallationIdModal extends React.Component {
  static propTypes = {
    installationId: PropTypes.string.isRequired,
    link: PropTypes.string.isRequired,
    closeModal: PropTypes.func.isRequired,
  };

  render() {
    const {installationId, link, closeModal} = this.props;
    return (
      <div>
        <ItemHolder>{t('Installation ID to Copy:')}</ItemHolder>
        <ItemHolder>
          <TextCopyInput value={installationId}>{installationId}</TextCopyInput>
        </ItemHolder>
        <ItemHolder>
          <ExternalLink href={link}>{t('Click here to continue')}</ExternalLink>
        </ItemHolder>
        <ButtonHolder>
          <Button size="small" onClick={closeModal}>
            {t('Close')}
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
