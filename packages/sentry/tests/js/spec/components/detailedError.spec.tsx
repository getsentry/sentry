import {render} from 'sentry-test/reactTestingLibrary';

import DetailedError from 'sentry/components/errors/detailedError';

describe('DetailedError', function () {
  it('renders', function () {
    const {container} = render(
      <DetailedError heading="Error heading" message={<div>Message</div>} />
    );

    expect(container).toSnapshot();
  });

  it('renders with "Retry" button', function () {
    const {container} = render(
      <DetailedError
        onRetry={() => {}}
        heading="Error heading"
        message={<div>Message</div>}
      />
    );

    expect(container).toSnapshot();
  });

  it('can hide support links', function () {
    const {container} = render(
      <DetailedError
        hideSupportLinks
        onRetry={() => {}}
        heading="Error heading"
        message={<div>Message</div>}
      />
    );

    expect(container).toSnapshot();
  });

  it('hides footer when no "Retry" and no support links', function () {
    const {container} = render(
      <DetailedError
        hideSupportLinks
        heading="Error heading"
        message={<div>Message</div>}
      />
    );

    expect(container).toSnapshot();
  });
});
