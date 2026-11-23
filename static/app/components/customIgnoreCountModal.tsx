import {Fragment, useState} from 'react';

import {Button} from '@sentry/scraps/button';
import {Grid} from '@sentry/scraps/layout';
import type {ModalRenderProps} from '@sentry/scraps/modal';
import type {SelectValue} from '@sentry/scraps/select';

import {t} from 'sentry/locale';
import type {IgnoredStatusDetails} from 'sentry/types/group';

import {NumberField} from './forms/fields/numberField';
import {SelectField} from './forms/fields/selectField';

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

export function CustomIgnoreCountModal(props: Props) {
  const [count, setCount] = useState(100);
  const [countWindow, setCountWindow] = useState<number | null>(null);
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
    if (countWindow) {
      statusDetails[windowName] = countWindow;
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
          value={countWindow}
          name="window"
          onChange={setCountWindow}
          options={windowOptions}
          placeholder={t('e.g. per hour')}
          allowClear
          help={t('(Optional) If supplied, this rule will apply as a rate of change.')}
        />
      </Body>
      <Footer>
        <Grid flow="column" align="center" gap="md">
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <Button variant="primary" onClick={handleSubmit}>
            {t('Ignore')}
          </Button>
        </Grid>
      </Footer>
    </Fragment>
  );
}
