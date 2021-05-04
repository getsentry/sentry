import {mountWithTheme} from 'sentry-test/enzyme';

import SimilarSpectrum from 'app/components/similarSpectrum';

describe('SimilarSpectrum', function () {
  beforeEach(function () {});

  afterEach(function () {});

  it('renders', function () {
    const wrapper = mountWithTheme(<SimilarSpectrum />);
    expect(wrapper).toSnapshot();
  });
});
