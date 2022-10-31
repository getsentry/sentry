import {Fragment, useState} from 'react';
import omit from 'lodash/omit';

import FormField from 'sentry/components/forms/formField';
import Input from 'sentry/components/input';

// XXX(epurkhiser): This is wrong, it should not be inheriting these props
import {InputFieldProps} from './inputField';

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

export default function FileField({accept, ...props}: FileFieldProps) {
  const [isUploading, setUploading] = useState(false);

  const handleFile = (onChange, e) => {
    const file = e.target.files[0];

    const reader = new FileReader();
    setUploading(true);
    reader.addEventListener(
      'load',
      () => {
        onChange([file.name, (reader.result as string).split(',')[1]], e);
        setUploading(false);
      },
      false
    );
    reader.readAsDataURL(file);
  };

  return (
    <FormField {...props}>
      {({children: _children, onChange, ...fieldProps}) => (
        <Fragment>
          <Input
            {...omit(fieldProps, 'value', 'onBlur', 'onKeyDown')}
            type="file"
            accept={accept?.join(', ')}
            onChange={e => handleFile(onChange, e)}
          />
          {isUploading ? (
            <div>This is a janky upload indicator. Wait to hit save!</div>
          ) : (
            ''
          )}
        </Fragment>
      )}
    </FormField>
  );
}
