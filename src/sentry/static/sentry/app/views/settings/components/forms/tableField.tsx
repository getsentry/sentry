import * as React from 'react';
import styled from '@emotion/styled';
import flatten from 'lodash/flatten';

import {defined, objectIsEmpty} from 'app/utils';
import {t} from 'app/locale';
import Button from 'app/components/button';
import Input from 'app/views/settings/components/forms/controls/input';
import InputField from 'app/views/settings/components/forms/inputField';
import space from 'app/styles/space';
import {IconAdd, IconDelete} from 'app/icons';
import Confirm from 'app/components/confirm';
import Alert from 'app/components/alert';
import {singleLineRenderer} from 'app/utils/marked';
import {TableType} from 'app/views/settings/components/forms/type';

const defaultProps = {
  /**
   * Text used for the 'add' button. An empty string can be used
   * to just render the "+" icon.
   */
  addButtonText: t('Add Item'),
  /**
   * Automatically save even if fields are empty
   */
  allowEmpty: false,
};

type DefaultProps = Readonly<typeof defaultProps>;
type Props = InputField['props'];
type RenderProps = Props & DefaultProps & TableType;

export default class TableField extends React.Component<Props> {
  static defaultProps = defaultProps;

  hasValue = value => defined(value) && !objectIsEmpty(value);

  renderField = (props: RenderProps) => {
    const {
      onChange,
      onBlur,
      addButtonText,
      columnLabels,
      columnKeys,
      disabled: rawDisabled,
      allowEmpty,
      confirmDeleteMessage,
    } = props;

    const mappedKeys = columnKeys || [];
    const emptyValue = mappedKeys.reduce((a, v) => ({...a, [v]: null}), {id: ''});

    const valueIsEmpty = this.hasValue(props.value);
    const value = valueIsEmpty ? (props.value as any[]) : [];

    const saveChanges = (nextValue: object[]) => {
      onChange?.(nextValue, []);

      //nextValue is an array of ObservableObjectAdministration objects
      const validValues = !flatten(Object.values(nextValue).map(Object.entries)).some(
        ([key, val]) => key !== 'id' && !val //don't allow empty values except if it's the ID field
      );

      if (allowEmpty || validValues) {
        //TOOD: add debouncing or use a form save button
        onBlur?.(nextValue, []);
      }
    };

    const addRow = () => {
      saveChanges([...value, emptyValue]);
    };

    const removeRow = rowIndex => {
      const newValue = [...value];
      newValue.splice(rowIndex, 1);
      saveChanges(newValue);
    };

    const setValue = (
      rowIndex: number,
      fieldKey: string,
      fieldValue: React.FormEvent<HTMLInputElement>
    ) => {
      const newValue = [...value];
      newValue[rowIndex][fieldKey] = fieldValue.currentTarget
        ? fieldValue.currentTarget.value
        : null;
      saveChanges(newValue);
    };

    //should not be a function for this component
    const disabled = typeof rawDisabled === 'function' ? false : rawDisabled;

    const button = (
      <Button
        icon={<IconAdd size="xs" isCircled />}
        onClick={addRow}
        size="xsmall"
        disabled={disabled}
      >
        {addButtonText}
      </Button>
    );

    // The field will be set to inline when there is no value set for the
    // field, just show the button.
    if (!valueIsEmpty) {
      return <div>{button}</div>;
    }

    const renderConfirmMessage = () => {
      return (
        <React.Fragment>
          <Alert type="error">
            <span
              dangerouslySetInnerHTML={{
                __html: singleLineRenderer(
                  confirmDeleteMessage || t('Are you sure you want to delete this item?')
                ),
              }}
            />
          </Alert>
        </React.Fragment>
      );
    };

    return (
      <React.Fragment>
        <HeaderContainer>
          {mappedKeys.map((fieldKey, i) => (
            <Header key={fieldKey}>
              <HeaderLabel>{columnLabels?.[fieldKey]}</HeaderLabel>
              {i === mappedKeys.length - 1 && button}
            </Header>
          ))}
        </HeaderContainer>
        {value.map((row, rowIndex) => (
          <RowContainer data-test-id="field-row" key={rowIndex}>
            {mappedKeys.map((fieldKey: string, i: number) => (
              <Row key={fieldKey}>
                <RowInput>
                  <Input
                    onChange={v => setValue(rowIndex, fieldKey, v)}
                    value={!defined(row[fieldKey]) ? '' : row[fieldKey]}
                  />
                </RowInput>
                {i === mappedKeys.length - 1 && (
                  <Confirm
                    priority="danger"
                    disabled={disabled}
                    onConfirm={() => removeRow(rowIndex)}
                    message={renderConfirmMessage()}
                  >
                    <RemoveButton>
                      <Button
                        icon={<IconDelete />}
                        size="small"
                        disabled={disabled}
                        label={t('delete')}
                      />
                    </RemoveButton>
                  </Confirm>
                )}
              </Row>
            ))}
          </RowContainer>
        ))}
      </React.Fragment>
    );
  };

  render() {
    //We need formatMessageValue=false since we're saving an object
    // and there isn't a great way to render the
    // change within the toast. Just turn off displaying the from/to portion of
    // the message
    return (
      <InputField
        {...this.props}
        formatMessageValue={false}
        inline={({model}) => !this.hasValue(model.getValue(this.props.name))}
        field={this.renderField}
      />
    );
  }
}

const HeaderLabel = styled('div')`
  font-size: 0.8em;
  text-transform: uppercase;
  color: ${p => p.theme.gray600};
`;

const HeaderContainer = styled('div')`
  display: flex;
  align-items: center;
`;

const Header = styled('div')`
  display: flex;
  flex: 1 0 0;
  align-items: center;
  justify-content: space-between;
`;

const RowContainer = styled('div')`
  display: flex;
  align-items: center;
  margin-top: ${space(1)};
`;

const Row = styled('div')`
  display: flex;
  flex: 1 0 0;
  align-items: center;
  margin-top: ${space(1)};
`;

const RowInput = styled('div')`
  flex: 1;
  margin-right: ${space(1)};
`;

const RemoveButton = styled('div')`
  margin-left: ${space(1)};
`;
