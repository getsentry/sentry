import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

import type {SaveButtonProps} from './saveButton';
import SaveButton from './saveButton';

type SaveButtonGroupProps = SaveButtonProps & {
  onClose: () => void;
};

function SaveButtonGroup({isEditing, onSave, setError, onClose}: SaveButtonGroupProps) {
  return (
    <SaveButtonGroupContainer>
      <SaveButton isEditing={isEditing} onSave={onSave} setError={setError} />
      <Button onClick={onClose} priority="default">
        {t('Cancel')}
      </Button>
    </SaveButtonGroupContainer>
  );
}

export default SaveButtonGroup;

const SaveButtonGroupContainer = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(1.5)};
`;
