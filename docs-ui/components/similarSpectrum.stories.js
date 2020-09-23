import React from 'react';
import {withInfo} from '@storybook/addon-info';

import SimilarSpectrum from 'app/components/similarSpectrum';

export default {
  title: 'DataVisualization/SimilarSpectrum',
};

export const _SimilarSpectrum = withInfo(
  'Similar Spectrum used in Similar Issues'
)(() => <SimilarSpectrum />);

_SimilarSpectrum.story = {
  name: 'SimilarSpectrum',
};
