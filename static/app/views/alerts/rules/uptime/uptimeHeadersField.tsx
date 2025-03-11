import {useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {Input} from 'sentry/components/core/input';
import type {FormFieldProps} from 'sentry/components/forms/formField';
import FormField from 'sentry/components/forms/formField';
import FormFieldControlState from 'sentry/components/forms/formField/controlState';
import {IconAdd, IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {uniqueId} from 'sentry/utils/guid';

/**
 * Matches characters that are not valid in a header name.
 */
const INVALID_NAME_HEADER_REGEX = new RegExp(/[^a-zA-Z0-9_-]+/g);

type HeaderEntry = [id: string, name: string, value: string];

// XXX(epurkhiser): The types of the FormField render props are absolutely
// abysmal, so we're leaving this untyped for now.

function UptimHeadersControl(props: any) {
  const {onChange, onBlur, disabled, model, name, value} = props;

  // Store itmes in local state so we can add empty values without persisting
  // those into the form model.
  const [items, setItems] = useState<HeaderEntry[]>(
    Object.keys(value).length > 0
      ? value.map((v: any) => [uniqueId(), ...v] as HeaderEntry)
      : [[uniqueId(), '', '']]
  );

  // Persist the field value back to the form model on changes to the items
  // list. Empty items are discarded and not persisted.
  useEffect(() => {
    const newValue = items.filter(item => item[1] !== '').map(item => [item[1], item[2]]);

    onChange(newValue, {});
    onBlur(newValue, {});
  }, [items, onChange, onBlur]);

  function addItem() {
    setItems(currentItems => [...currentItems, [uniqueId(), '', '']]);
  }

  function removeItem(index: number) {
    setItems(currentItems => currentItems.toSpliced(index, 1));
  }

  function handleNameChange(index: number, newName: string) {
    setItems(currentItems =>
      currentItems.toSpliced(index, 1, [
        items[index]![0],
        newName.replaceAll(INVALID_NAME_HEADER_REGEX, ''),
        items[index]![2],
      ])
    );
  }

  function handleValueChange(index: number, newHeaderValue: string) {
    setItems(currentItems =>
      currentItems.toSpliced(index, 1, [
        items[index]![0],
        items[index]![1],
        newHeaderValue,
      ])
    );
  }

  /**
   * Disambiguates headers that are named the same by adding a `(x)` number to
   * the end of the name in the order they were added.
   */
  function disambiguateHeaderName(index: number) {
    const headerName = items[index]![1];
    const matchingIndexes = items
      .map((item, idx) => [idx, item[1]])
      .filter(([_, itemName]) => itemName === headerName)
      .map(([idx]) => idx);

    const duplicateIndex = matchingIndexes.indexOf(index) + 1;

    return duplicateIndex === 1 ? headerName : `${headerName} (${duplicateIndex})`;
  }

  return (
    <HeadersContainer>
      {items.length > 0 && (
        <HeaderItems>
          {items.map(([id, headerName, headerValue], index) => (
            <HeaderRow key={id}>
              <Input
                monospace
                disabled={disabled}
                value={headerName ?? ''}
                placeholder="X-Header-Value"
                onChange={e => handleNameChange(index, e.target.value)}
                aria-label={t('Name of header %s', index + 1)}
              />
              <Input
                monospace
                disabled={disabled}
                value={headerValue ?? ''}
                placeholder={t('Header Value')}
                onChange={e => handleValueChange(index, e.target.value)}
                aria-label={
                  headerName
                    ? t('Value of %s', disambiguateHeaderName(index))
                    : t('Value of header %s', index + 1)
                }
              />
              <Button
                disabled={disabled}
                icon={<IconDelete />}
                size="sm"
                borderless
                aria-label={
                  headerName
                    ? t('Remove %s', disambiguateHeaderName(index))
                    : t('Remove header %s', index + 1)
                }
                onClick={() => removeItem(index)}
              />
            </HeaderRow>
          ))}
        </HeaderItems>
      )}
      <HeaderActions>
        <Button disabled={disabled} icon={<IconAdd />} size="sm" onClick={addItem}>
          {t('Add Header')}
        </Button>
        <FormFieldControlState model={model} name={name} />
      </HeaderActions>
    </HeadersContainer>
  );
}

export function UptimeHeadersField(props: Omit<FormFieldProps, 'children'>) {
  return (
    <FormField defaultValue={[]} {...props} hideControlState flexibleControlStateSize>
      {({ref: _ref, ...fieldProps}) => <UptimHeadersControl {...fieldProps} />}
    </FormField>
  );
}

const HeadersContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const HeaderActions = styled('div')`
  display: flex;
  gap: ${space(1.5)};
`;

const HeaderItems = styled('fieldset')`
  display: grid;
  grid-template-columns: minmax(200px, 1fr) 2fr max-content;
  gap: ${space(1)};
  width: 100%;
`;

const HeaderRow = styled('div')`
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / -1;
  align-items: center;
`;
