import {render} from 'sentry-test/reactTestingLibrary';

import NewProviderForm from 'sentry/views/settings/featureFlags/changeTracking/newProviderForm';

describe('NewProviderForm', () => {
  it('renders', () => {
    const callback = () => {};
    render(<NewProviderForm onSetProvider={callback} onCreatedSecret={callback} />);
  });
});
