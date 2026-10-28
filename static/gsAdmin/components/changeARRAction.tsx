import {Fragment, useState} from 'react';

import {Button, ButtonBar} from '@sentry/scraps/button';
import {useModal} from '@sentry/scraps/modal';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {NumberField} from 'sentry/components/forms/fields/numberField';

type Props = {
  // TODO(ts): Type customer when available
  customer: any;
  onAction: (data: any) => void;
};

export function ChangeARRAction(props: Props) {
  const {openModal} = useModal();

  return (
    <Button
      variant="link"
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

function ChangeARRModal({
  customer,
  onAction,
  closeModal,
  Header,
  Body,
  Footer,
}: ModalProps) {
  const [newAcv, setNewAcv] = useState<number>(customer.acv / 100);
  const [error, setError] = useState(false);

  const handleChange = (value: string) => {
    const parsedAcv = parseInt(value, 10) || 0;
    setNewAcv(parsedAcv);
    setError(parsedAcv < 0);
  };

  const handleAction = () => {
    closeModal();
    if (!error) {
      onAction({customPrice: newAcv * 100});
    }
  };

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
              <strong>${newAcv.toLocaleString()}</strong>
            </Fragment>
          }
          defaultValue={customer.acv / 100}
          onChange={handleChange}
        />
      </Body>
      <Footer>
        <ButtonBar>
          <Button onClick={closeModal}>Cancel</Button>
          <Button variant="primary" onClick={handleAction} disabled={error}>
            Submit
          </Button>
        </ButtonBar>
      </Footer>
    </Fragment>
  );
}
