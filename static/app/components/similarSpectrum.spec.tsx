import {render} from 'sentry-test/reactTestingLibrary';

import SimilarSpectrum from 'sentry/components/similarSpectrum';

import {t} from '../locale';

describe('SimilarSpectrum', function () {
  beforeEach(function () {});

  afterEach(function () {});

  it('renders', function () {
    render(
      <SimilarSpectrum
        highSpectrumLabel={t('Similar')}
        lowSpectrumLabel={t('Not Similar')}
      />
    );
  });
});
