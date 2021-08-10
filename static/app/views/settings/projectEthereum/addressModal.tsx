import * as React from 'react';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {ModalRenderProps} from 'app/actionCreators/modal';
import {Client} from 'app/api';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import {t} from 'app/locale';
import {formatEthAddress, stripEthAddress} from 'app/utils/ethereum';

import {TextareaField, TextField} from '../components/forms';

import {EthAddress} from '.';

type Props = ModalRenderProps & {
  api: Client;
  baseUrl: string;
  onSubmitSuccess: () => void;
  initialData?: EthAddress;
};

type State = {
  address: string;
  displayName: string;
  abiContents: string;
};

class Form extends React.Component<Props, State> {
  state: State = {
    displayName: this.props.initialData?.displayName || '',
    address: this.props.initialData?.address
      ? formatEthAddress(this.props.initialData.address)
      : '',
    abiContents: this.props.initialData?.abiContents || '',
  };

  handleSave = async () => {
    const {api, onSubmitSuccess, closeModal, baseUrl, initialData} = this.props;
    const {address, displayName, abiContents} = this.state;

    // TODO(eth): validation

    try {
      if (initialData) {
        await api.requestPromise(`${baseUrl}${initialData.id}/`, {
          method: 'PUT',
          data: {
            address: stripEthAddress(address),
            displayName,
            abiContents,
          },
        });
      } else {
        await api.requestPromise(baseUrl, {
          method: 'POST',
          data: {
            address: stripEthAddress(address),
            displayName,
            abiContents,
          },
        });
      }

      addSuccessMessage(
        initialData
          ? t('Address updated successfully.')
          : t('Address created successfully.')
      );
      onSubmitSuccess();
      closeModal();
    } catch (error) {
      addErrorMessage(error.responseJSON?.detail ?? t('Unable to save address.'));
    }
  };

  render() {
    const {Header, Body, closeModal, Footer, initialData} = this.props;
    const {displayName, address, abiContents} = this.state;

    return (
      <React.Fragment>
        <Header closeButton>
          <h4>{initialData ? t('Edit Ethereum Address') : t('Add Ethereum Address')}</h4>
        </Header>
        <Body>
          <TextField
            label={t('Display Name')}
            name="displayName"
            onChange={value => this.setState({displayName: value})}
            placeholder={t('My Smart Contract')}
            value={displayName}
            inline={false}
            stacked
          />
          <TextField
            label={t('Address')}
            name="address"
            onChange={value => this.setState({address: value})}
            placeholder="0x0000000000000000000000000000000000000000"
            value={address}
            inline={false}
            stacked
            required
            disabled={!!initialData}
          />
          <TextareaField
            label={t('Abi')}
            name="abi"
            onChange={value => this.setState({abiContents: value})}
            value={abiContents}
            autosize
            rows={5}
            inline={false}
            stacked
          />
        </Body>
        <Footer>
          <ButtonBar gap={1}>
            <Button onClick={closeModal}>{t('Cancel')}</Button>
            <Button priority="primary" onClick={this.handleSave}>
              {t('Save Address')}
            </Button>
          </ButtonBar>
        </Footer>
      </React.Fragment>
    );
  }
}

export default Form;
