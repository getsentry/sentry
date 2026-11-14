import {Container} from '@sentry/scraps/layout';

import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';

// SSR snapshot tests have no router, so the URL-backed builder state is stubbed.
jest.mock('sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext', () => ({
  useWidgetBuilderContext: () => ({
    state: {
      dataset: WidgetType.SPANS,
      displayType: DisplayType.LINE,
      thresholds: {max_values: {max1: 200, max2: 2500}, unit: null},
    },
    dispatch: () => {},
  }),
}));

// These pull in every dataset config, which does not load under SSR. The
// section only needs them to decide whether to show the interval picker.
jest.mock('sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState', () => ({
  BuilderStateAction: {SET_THRESHOLDS: 'SET_THRESHOLDS'},
}));
jest.mock(
  'sentry/views/dashboards/widgetBuilder/utils/convertBuilderStateToWidget',
  () => ({
    convertBuilderStateToWidget: () => ({}),
  })
);
jest.mock('sentry/views/dashboards/widgetCard/canScaleThresholds', () => ({
  canScaleThresholds: () => false,
}));

import {ThresholdsSection} from './thresholds';

describe('ThresholdsSection', () => {
  it.snapshot('section title and threshold fields', () => (
    <Container padding="xl" width="560px">
      <ThresholdsSection dataType="duration" dataUnit="millisecond" />
    </Container>
  ));
});
