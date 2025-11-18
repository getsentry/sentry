import {render} from 'sentry-test/reactTestingLibrary';

import SimilarSpectrum from 'sentry/components/similarSpectrum';

describe('SimilarSpectrum', () => {
  it('renders', () => {
    render(
      <SimilarSpectrum highSpectrumLabel="Similar" lowSpectrumLabel="Not Similar" />
    );
  });
});
