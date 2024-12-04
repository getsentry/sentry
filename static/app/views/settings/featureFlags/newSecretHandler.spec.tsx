import {SecretFixture} from 'sentry-fixture/secret';

import {render} from 'sentry-test/reactTestingLibrary';

import NewSecretHandler from 'sentry/views/settings/featureFlags/newSecretHandler';

describe('NewSecretHandler', () => {
  it('renders', () => {
    const callback = ({}) => {};
    render(<NewSecretHandler secret={SecretFixture().secret} onGoBack={callback} />);
  });
});
