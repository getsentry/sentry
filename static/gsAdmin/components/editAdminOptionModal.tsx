import {Fragment, useMemo} from 'react';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Alert} from 'sentry/components/core/alert';
import BooleanField from 'sentry/components/forms/fields/booleanField';
import RangeField from 'sentry/components/forms/fields/rangeField';

import type {SerializedOption} from 'admin/views/options';

interface EditAdminOptionModalProps extends ModalRenderProps {
  allOptions: SerializedOption[];
  option: SerializedOption;
  path: string;
}

function EditAdminOptionModal({
  Body,
  Header,
  option,
  allOptions,
}: EditAdminOptionModalProps) {
  const groupedOptions = useMemo(() => {
    const options = option.groupingInfo
      ? allOptions.filter(o => o.groupingInfo?.name === option.groupingInfo?.name)
      : [option];
    options.sort((a, b) => (a.groupingInfo?.order || 0) - (b.groupingInfo?.order || 0));
    return options;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Fragment>
      <Header closeButton>Edit Option {option.groupingInfo ? 'Group' : null}</Header>
      <Body>
        <Alert.Container>
          <Alert variant="info" showIcon={false}>
            Options setting through _admin is deprecated. Please use the options
            automator.
          </Alert>
        </Alert.Container>
        {groupedOptions.map(o => (
          <EditOption key={o.name} option={o} />
        ))}
      </Body>
    </Fragment>
  );
}

function EditOption({option}: {option: SerializedOption}) {
  return option.fieldType === 'bool' ? (
    <BooleanField
      label={option.name}
      name={option.name}
      value={option.value}
      alignRight
      flexibleControlStateSize
      size="sm"
    />
  ) : (
    <Fragment>
      <RangeField
        label={option.name}
        name={option.name}
        min={0}
        max={1}
        step={0.01}
        value={option.value}
        alignRight
        flexibleControlStateSize
        size="xs"
      />
    </Fragment>
  );
}

// TODO(TS): Type cast added as part of react 18 upgrade, can remove after?
export default EditAdminOptionModal;
