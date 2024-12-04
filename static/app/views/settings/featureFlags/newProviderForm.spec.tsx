import {render} from 'sentry-test/reactTestingLibrary';

import NewProviderForm from 'sentry/views/settings/featureFlags/newProviderForm';

describe('NewProviderForm', () => {
  it('renders', () => {
    const callback = ({}) => {};
    render(<NewProviderForm onCreatedSecret={callback} />);
  });
});
