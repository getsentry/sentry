import * as React from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {ModalRenderProps} from 'app/actionCreators/modal';
import {Client} from 'app/api';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import {t} from 'app/locale';
import space from 'app/styles/space';

import {TextareaField, TextField} from '../components/forms';

import {EthAddress} from '.';

type Props = ModalRenderProps & {
  api: Client;
  baseUrl: string;
  onSubmitSuccess: () => void;
  address?: EthAddress;
};

type State = {
  address?: string;
  displayName?: string;
  abi?: string;
};

class Form extends React.Component<Props, State> {
  state: State = {
    address: this.props.address?.address || '',
    displayName: this.props.address?.displayName || '',
    abi: this.props.address?.abi || '',
  };

  handleSave = async () => {
    const {api, onSubmitSuccess, closeModal, baseUrl} = this.props;
    const {address, displayName, abi} = this.state;

    try {
      await api.requestPromise(baseUrl, {
        method: 'POST',
        data: {
          address,
          displayName,
          abi,
        },
      });

      addSuccessMessage(
        this.props.address
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
    const {Header, Body, closeModal, Footer} = this.props;

    return (
      <React.Fragment>
        <Header closeButton>
          <h4>
            {this.props.address ? t('Edit Ethereum Address') : t('Add Ethereum Address')}
          </h4>
        </Header>
        <Body>
          <Fields>
            <TextField
              label={t('Display Name')}
              name="displayName"
              onChange={displayName => this.setState({displayName})}
              placeholder="My Smart Contract"
              value={this.state.displayName}
              inline={false}
              stacked
              required
            />
            <TextField
              label={t('Address')}
              name="address"
              onChange={address => this.setState({address})}
              placeholder="0x0000000000000000000000000000000000000000"
              value={this.state.address}
              inline={false}
              stacked
              required
            />
            <TextareaField
              label={t('Abi')}
              name="abi"
              onChange={abi => this.setState({abi})}
              value={this.state.abi}
              autosize
              rows={5}
              inline={false}
              stacked
            />
          </Fields>
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

const Fields = styled('div')`
  display: grid;
  grid-gap: ${space(1)};
`;
