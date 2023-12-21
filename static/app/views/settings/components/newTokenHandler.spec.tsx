import {render} from 'sentry-test/reactTestingLibrary';

import NewTokenHandler from 'sentry/views/settings/components/newTokenHandler';

describe('NewTokenHandler', () => {
  it('renders', () => {
    const callback = ({}) => {};
    render(<NewTokenHandler token={TestStubs.ApiToken()} handleGoBack={callback} />);
  });
});
