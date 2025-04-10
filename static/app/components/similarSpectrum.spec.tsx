import {render} from 'sentry-test/reactTestingLibrary';

import SimilarSpectrum from 'sentry/components/similarSpectrum';

describe('SimilarSpectrum', function () {
  it('renders', function () {
    render(
      <SimilarSpectrum highSpectrumLabel={'Similar'} lowSpectrumLabel={'Not Similar'} />
    );
  });
});
