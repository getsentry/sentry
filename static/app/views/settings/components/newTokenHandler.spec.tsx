import {ApiToken as ApiTokenFixture} from 'sentry-fixture/apiToken';

import {render} from 'sentry-test/reactTestingLibrary';

import NewTokenHandler from 'sentry/views/settings/components/newTokenHandler';

describe('NewTokenHandler', () => {
  it('renders', () => {
    const callback = ({}) => {};
    render(<NewTokenHandler token={ApiTokenFixture().token} handleGoBack={callback} />);
  });
});
