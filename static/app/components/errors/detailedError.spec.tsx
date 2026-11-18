import {render} from 'sentry-test/reactTestingLibrary';

import {DetailedError} from './detailedError';

describe('DetailedError', () => {
  it('renders', () => {
    render(<DetailedError heading="Error heading" message={<div>Message</div>} />);
  });

  it('renders with "Retry" button', () => {
    render(
      <DetailedError
        onRetry={() => {}}
        heading="Error heading"
        message={<div>Message</div>}
      />
    );
  });

  it('can hide support links', () => {
    render(
      <DetailedError
        hideSupportLinks
        onRetry={() => {}}
        heading="Error heading"
        message={<div>Message</div>}
      />
    );
  });

  it('hides footer when no "Retry" and no support links', () => {
    render(
      <DetailedError
        hideSupportLinks
        heading="Error heading"
        message={<div>Message</div>}
      />
    );
  });
});
