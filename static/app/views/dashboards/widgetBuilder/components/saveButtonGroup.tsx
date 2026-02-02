import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';

import type {SaveButtonProps} from './saveButton';
import SaveButton from './saveButton';

type SaveButtonGroupProps = SaveButtonProps & {
  onClose: () => void;
};

function SaveButtonGroup({isEditing, onSave, setError, onClose}: SaveButtonGroupProps) {
  return (
    <Flex gap="lg">
      <SaveButton isEditing={isEditing} onSave={onSave} setError={setError} />
      <Button onClick={onClose} priority="default">
        {t('Cancel')}
      </Button>
    </Flex>
  );
}

export default SaveButtonGroup;
