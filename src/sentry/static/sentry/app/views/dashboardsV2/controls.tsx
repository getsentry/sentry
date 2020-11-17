import React from 'react';
import styled from '@emotion/styled';
// eslint-disable-next-line import/named
import {components, SingleValueProps, OptionProps} from 'react-select';

import {t} from 'app/locale';
import {IconAdd, IconEdit} from 'app/icons';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import SelectControl from 'app/components/forms/selectControl';

type FieldValue =
  | {
      type: 'user';
      id: number;
      name: string;
    }
  | {
      type: 'prebuilt';
      name: string;
    };

type OptionType = {
  label: string;
  value: FieldValue;
};

type Props = {
  onEdit: () => void;
  editing: boolean;
};
class Controls extends React.Component<Props> {
  render() {
    const {editing} = this.props;

    if (editing) {
      return (
        <ButtonBar gap={1} key="edit-controls">
          <Button
            onClick={e => {
              e.preventDefault();
              this.props.onEdit();
            }}
            href="#finish-editing"
            priority="primary"
            size="small"
          >
            {t('Finish Editing')}
          </Button>
        </ButtonBar>
      );
    }

    return (
      <ButtonBar gap={1} key="controls">
        <Button
          onClick={e => {
            e.preventDefault();
            this.props.onEdit();
          }}
          href="#edit"
          icon={<IconEdit size="xs" />}
          size="small"
        >
          {t('Edit')}
        </Button>
        <DashboardSelect>
          <SelectControl
            key="select"
            name="parameter"
            placeholder={t('Select Dashboard')}
            options={[
              {
                label: `${t('All Events')} (${t('prebuilt')})`,
                value: {
                  type: 'prebuilt',
                  name: t('All Events'),
                },
              },
            ]}
            value={{
              label: `${t('All Events')} (${t('prebuilt')})`,
              value: {
                type: 'prebuilt',
                name: t('All Events'),
              },
            }}
            components={{
              Option: ({label, data, ...props}: OptionProps<OptionType>) => (
                <components.Option label={label} {...(props as any)}>
                  <span>{label}</span>
                </components.Option>
              ),
              SingleValue: ({data, ...props}: SingleValueProps<OptionType>) => (
                <components.SingleValue data={data} {...(props as any)}>
                  <span>{data.label}</span>
                </components.SingleValue>
              ),
            }}
            onChange={() => {}}
          />
        </DashboardSelect>
        <Button
          onClick={e => {
            e.preventDefault();

            console.log('create dashboard');
          }}
          priority="primary"
          href="#create-dashboard"
          icon={<IconAdd size="xs" isCircled />}
          size="small"
        >
          {t('Create Dashboard')}
        </Button>
      </ButtonBar>
    );
  }
}

const DashboardSelect = styled('div')`
  min-width: 200px;
  font-size: ${p => p.theme.fontSizeMedium};
`;

export default Controls;
