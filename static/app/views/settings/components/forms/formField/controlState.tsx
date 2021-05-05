import {Observer} from 'mobx-react';

import FormState from 'app/components/forms/state';
import ControlState from 'app/views/settings/components/forms/field/controlState';
import FormModel from 'app/views/settings/components/forms/model';

type Props = {
  model: FormModel;
  name: string;
};

/**
 * ControlState (i.e. loading/error icons) for connected form components
 */
const FormFieldControlState = ({model, name}: Props) => (
  <Observer>
    {() => {
      const isSaving = model.getFieldState(name, FormState.SAVING);
      const isSaved = model.getFieldState(name, FormState.READY);
      const error = model.getError(name);

      return <ControlState isSaving={isSaving} isSaved={isSaved} error={error} />;
    }}
  </Observer>
);

export default FormFieldControlState;
