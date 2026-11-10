import {render} from 'sentry-test/reactTestingLibrary';

import {NewProviderForm} from './newProviderForm';

describe('NewProviderForm', () => {
  it('renders', () => {
    const callback = () => {};
    render(
      <NewProviderForm
        onCreatedSecret={callback}
        setSelectedProvider={callback}
        setError={callback}
        canSaveSecret
        existingSecret={undefined}
      />
    );
  });
});
