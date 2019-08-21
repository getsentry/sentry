import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import Button from 'app/components/button';

import TextCopyInput from 'app/views/settings/components/forms/textCopyInput';
import {t} from 'app/locale';

export default class InstallationIdModal extends React.Component {
  static propTypes = {
    installationId: PropTypes.string.isRequired,
    link: PropTypes.string.isRequired,
    closeModal: PropTypes.func.isRequired,
  };

  render() {
    const {installationId, link, closeModal} = this.props;
    return (
      <Holder>
        <div>{t('Installation ID to Copy:')}</div>
        <div>
          <TextCopyInput>{installationId}</TextCopyInput>
        </div>
        <div>
          <a target="_blank" rel="noreferrer noopener" href={link}>
            {t('Click here to continue')}
          </a>
        </div>
        <Button size="small" onClick={closeModal}>
          {t('Close')}
        </Button>
      </Holder>
    );
  }
}

const Holder = styled('div')`
  & > * {
    margin: 10px;
  }
  & > button {
    float: right;
  }
  padding-bottom: 40px;
`;
