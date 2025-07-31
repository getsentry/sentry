import {Observer} from 'mobx-react';

import {ControlState} from 'sentry/components/forms/fieldGroup/controlState';
import type FormModel from 'sentry/components/forms/model';
import FormState from 'sentry/components/forms/state';

type Props = {
  model: FormModel;
  name: string;
  hideErrorMessage?: boolean;
};

/**
 * ControlState (i.e. loading/error icons) for connected form components
 */
function FormFieldControlState({model, name, hideErrorMessage}: Props) {
  return (
    <Observer>
      {() => {
        const isSaving = model.getFieldState(name, FormState.SAVING);
        const isSaved = model.getFieldState(name, FormState.READY);
        const error = model.getError(name);

        return (
          <ControlState
            isSaving={isSaving}
            isSaved={isSaved}
            error={error}
            hideErrorMessage={hideErrorMessage}
          />
        );
      }}
    </Observer>
  );
}

export default FormFieldControlState;
