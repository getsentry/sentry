import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import SimilarSpectrum from 'app/components/similarSpectrum';

storiesOf('SimilarSpectrum', module).add(
  'default',
  withInfo('Description')(() => <SimilarSpectrum />)
);
