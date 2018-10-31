import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import SimilarSpectrum from 'app/components/similarSpectrum';

storiesOf('Other|SimilarSpectrum', module).add(
  'SimilarSpectrum',
  withInfo('Similar Spectrum used in Similar Issues')(() => <SimilarSpectrum />)
);
