import {render} from 'sentry-test/reactTestingLibrary';

import SimilarSpectrum from 'sentry/components/similarSpectrum';

describe('SimilarSpectrum', function () {
  beforeEach(function () {});

  afterEach(function () {});

  it('renders', function () {
    const {container} = render(<SimilarSpectrum />);
    expect(container).toSnapshot();
  });
});
