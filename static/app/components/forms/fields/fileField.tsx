import {useState} from 'react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

import {InputGroup} from 'sentry/components/core/input/inputGroup';
import FormField from 'sentry/components/forms/formField';
import FormFieldControlState from 'sentry/components/forms/formField/controlState';
import type FormModel from 'sentry/components/forms/model';
import {t} from 'sentry/locale';

// XXX(epurkhiser): This is wrong, it should not be inheriting these props
import type {InputFieldProps} from './inputField';

export interface FileFieldProps extends Omit<InputFieldProps, 'type' | 'accept'> {
  accept?: string[];
  // TODO(dcramer): multiple is native to the file input type, but not yet supported
  // multiple?: boolean;
}

// XXX(dcramer): This stores files in memory - serialized into the forms values
// which is not ideal, but is compatible with the API-side SerializedFileField.

// TODO(dcramer): it'd be nice if the form api supported a validation state, so
// async controls like this would could finish their work and disable submission.
// Until that is done though if you try to submit the form while this is uploading
// you will just submit the form without the field.

export default function FileField({accept, hideControlState, ...props}: FileFieldProps) {
  const [fileName, setFileName] = useState('');
  const handleFile = (
    model: FormModel,
    name: string,
    onChange: (value: any, e: React.ChangeEvent<HTMLInputElement>) => void,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];

    // No file selected
    if (!file) {
      onChange([], e);
      return;
    }

    model.setSaving(name, true);
    const reader = new FileReader();
    reader.addEventListener(
      'load',
      () => {
        setFileName(file.name);
        onChange([file.name, (reader.result as string).split(',')[1]], e);
        model.setSaving(name, false);
      },
      false
    );
    reader.readAsDataURL(file);
  };

  return (
    <FormField {...props} hideControlState>
      {({
        children: _children,
        onChange,
        name,
        model,
        ...fieldProps
      }: {
        children: React.ReactNode;
        model: FormModel;
        name: string;
        onChange: (value: any, event?: React.FormEvent<HTMLInputElement>) => void;
      }) => {
        return (
          <InputGroup>
            <InputGroup.LeadingItems disablePointerEvents>
              <FileName hasFile={!!fileName}>
                {fileName || t('No file selected')}
              </FileName>
            </InputGroup.LeadingItems>
            <FileInput
              {...omit(fieldProps, 'value', 'onBlur', 'onKeyDown')}
              type="file"
              name={name}
              accept={accept?.join(', ')}
              onChange={e => handleFile(model, name, onChange, e)}
            />
            {!hideControlState && (
              <InputGroup.TrailingItems disablePointerEvents>
                <FormFieldControlState name={name} model={model} />
                <BrowseIndicator>Browse</BrowseIndicator>
              </InputGroup.TrailingItems>
            )}
          </InputGroup>
        );
      }}
    </FormField>
  );
}

const FileName = styled('span')<{hasFile: boolean}>`
  color: ${p => (p.hasFile ? p.theme.textColor : p.theme.subText)};
`;

const BrowseIndicator = styled('span')`
  color: ${p => p.theme.activeText};
`;

const FileInput = styled(InputGroup.Input)`
  cursor: pointer;
  color: transparent;

  ::file-selector-button {
    display: none;
  }
  ::-webkit-file-upload-button {
    display: none;
  }
`;
