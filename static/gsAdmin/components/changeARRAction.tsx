import {Component, Fragment} from 'react';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import NumberField from 'sentry/components/forms/fields/numberField';

type Props = {
  // TODO(ts): Type customer when available
  customer: any;
  onAction: (data: any) => void;
};

function ChangeARRAction(props: Props) {
  return (
    <Button
      priority="link" redesign
      size="zero"
      onClick={() =>
        openModal(renderProps => <ChangeARRModal {...props} {...renderProps} />)
      }
    >
      Change
    </Button>
  );
}

type ModalProps = ModalRenderProps & Props;

type ModalState = {
  error: boolean;
  newAcv: number;
};

class ChangeARRModal extends Component<ModalProps, ModalState> {
  state: ModalState = {
    newAcv: this.props.customer.acv / 100,
    error: false,
  };

  onChange = (value: string) => {
    const newAcv = parseInt(value, 10) || 0;
    this.setState({newAcv, error: newAcv < 0});
  };

  onAction = () => {
    this.props.closeModal();
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    !this.state.error && this.props.onAction({customPrice: this.state.newAcv * 100});
  };

  render() {
    const {Header, closeModal, Body, Footer} = this.props;

    return (
      <Fragment>
        <Header>Update Annual Recurring Revenue</Header>
        <Body>
          <NumberField
            name="acv"
            label="ARR"
            stacked
            inline={false}
            help={
              <Fragment>
                Their new annual contract value will be{' '}
                <strong>${this.state.newAcv.toLocaleString()}</strong>
              </Fragment>
            }
            defaultValue={this.props.customer.acv / 100}
            onChange={this.onChange}
          />
        </Body>
        <Footer>
          <ButtonBar gap={1}>
            <Button onClick={closeModal} redesign>Cancel</Button>
            <Button
              priority="primary" redesign
              onClick={this.onAction}
              disabled={this.state.error}
            >
              Submit
            </Button>
          </ButtonBar>
        </Footer>
      </Fragment>
    );
  }
}

export default ChangeARRAction;
