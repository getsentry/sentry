import {Fragment, useState} from 'react';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import NumberField from 'sentry/components/forms/fields/numberField';
import SelectField from 'sentry/components/forms/fields/selectField';
import {t} from 'sentry/locale';
import type {SelectValue} from 'sentry/types/core';
import type {IgnoredStatusDetails} from 'sentry/types/group';

type CountNames = 'ignoreCount' | 'ignoreUserCount';
type WindowNames = 'ignoreWindow' | 'ignoreUserWindow';

type Props = ModalRenderProps & {
  countLabel: string;
  countName: CountNames;
  label: string;
  onSelected: (statusDetails: IgnoredStatusDetails) => void;
  windowName: WindowNames;
  windowOptions: Array<SelectValue<number>>;
};

export default function CustomIgnoreCountModal(props: Props) {
  const [count, setCount] = useState<number>(100);
  const [window, setWindow] = useState<number | null>(null);
  const {
    Header,
    Footer,
    Body,
    countLabel,
    label,
    windowOptions,
    countName,
    windowName,
    onSelected,
    closeModal,
  } = props;

  const handleSubmit = () => {
    const statusDetails: IgnoredStatusDetails = {[countName]: count};
    if (window) {
      statusDetails[windowName] = window;
    }
    onSelected(statusDetails);
    closeModal();
  };

  return (
    <Fragment>
      <Header>
        <h4>{label}</h4>
      </Header>
      <Body>
        <NumberField
          inline={false}
          flexibleControlStateSize
          stacked
          label={countLabel}
          name="count"
          value={count}
          onChange={setCount}
          required
          placeholder={t('e.g. 100')}
        />
        <SelectField
          inline={false}
          flexibleControlStateSize
          stacked
          label={t('Time window')}
          value={window}
          name="window"
          onChange={setWindow}
          options={windowOptions}
          placeholder={t('e.g. per hour')}
          allowClear
          help={t('(Optional) If supplied, this rule will apply as a rate of change.')}
        />
      </Body>
      <Footer>
        <ButtonBar gap={1}>
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <Button priority="primary" onClick={handleSubmit}>
            {t('Ignore')}
          </Button>
        </ButtonBar>
      </Footer>
    </Fragment>
  );
}
