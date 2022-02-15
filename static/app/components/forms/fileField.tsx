import {Fragment, useState} from 'react';
import omit from 'lodash/omit';

import Input from 'sentry/components/forms/controls/input';
import InputField from 'sentry/components/forms/inputField';

type Props = Omit<InputField['props'], 'type' | 'accept'> & {
  accept?: string[];
  // TODO(dcramer): multiple is native to the file input type, but not yet supported
  // mulitiple?: boolean;
};

// XXX(dcramer): This stores files in memory - serialized into the forms values
// which is not ideal, but is compatible with the API-side SerializedFileField.

// TODO(dcramer): it'd be nice if the form api supported a validation state, so
// async controls like this would could finish their work and disable submission.
// Until that is done though if you try to submit the form while this is uploading
// you will just submit the form without the field.

export default function FileField({accept, ...props}: Props) {
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
    <InputField
      {...props}
      accept={accept ? accept.join(', ') : undefined}
      field={({onChange, ...fieldProps}) => {
        return (
          <Fragment>
            <Input
              {...omit(fieldProps, 'value', 'onBlur', 'onKeyDown')}
              type="file"
              onChange={e => handleFile(onChange, e)}
            />
            {isUploading ? (
              <div>This is a janky upload indicator. Wait to hit save!</div>
            ) : (
              ''
            )}
          </Fragment>
        );
      }}
    />
  );
}
