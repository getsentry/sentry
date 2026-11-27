import {Fragment} from 'react';

import {Alert} from '@sentry/scraps/alert';
import {DisplayField} from '@sentry/scraps/form';
import type {ModalRenderProps} from '@sentry/scraps/modal';
import {Text} from '@sentry/scraps/text';

import type {SerializedOption} from 'admin/views/options';

interface EditAdminOptionModalProps extends ModalRenderProps {
  allOptions: SerializedOption[];
  option: SerializedOption;
  path: string;
}

export function EditAdminOptionModal({
  Body,
  Header,
  option,
  allOptions,
}: EditAdminOptionModalProps) {
  const groupedOptions = option.groupingInfo
    ? allOptions
        .filter(o => o.groupingInfo?.name === option.groupingInfo?.name)
        .sort((a, b) => (a.groupingInfo?.order || 0) - (b.groupingInfo?.order || 0))
    : [option];

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
          <DisplayField.Row key={o.name} label={o.name}>
            <Text>{JSON.stringify(o.value)}</Text>
          </DisplayField.Row>
        ))}
      </Body>
    </Fragment>
  );
}
