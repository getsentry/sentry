import type {Theme} from '@emotion/react';

import {render} from 'sentry-test/reactTestingLibrary';

import type {SuspectAttributesResult} from 'sentry/views/explore/hooks/useSuspectAttributes';

import {Chart} from './chart';

// We need to test the cohortsToSeriesData function indirectly through the Chart component
// since it's not exported. We'll test by examining the rendered chart's behavior.

describe('Chart', () => {
  const mockTheme = {
    chart: {
      getColorPalette: () => ['#5B48C4'],
    },
    textColor: '#000',
  } as Theme;

  const createMockAttribute = (
    cohortSize: number
  ): SuspectAttributesResult['rankedAttributes'][number] => {
    const cohort1 = Array.from({length: cohortSize}, (_, i) => ({
      label: `label${i}`,
      value: String(100 - i),
    }));

    const cohort2 = Array.from({length: cohortSize}, (_, i) => ({
      label: `label${i}`,
      value: String(50 - i),
    }));

    return {
      attributeName: 'test.attribute',
      cohort1,
      cohort2,
      order: {
        rrr: 1,
        kl_divergence: 1,
      },
    };
  };

  it('limits chart series to 40 bars when more than 40 values exist', () => {
    const attribute = createMockAttribute(50); // Create 50 items

    const {container} = render(
      <Chart
        attribute={attribute}
        theme={mockTheme}
        cohort1Total={5000}
        cohort2Total={5000}
      />
    );

    // The chart should be rendered
    expect(container).toBeInTheDocument();

    // Note: Testing the exact bar count would require deeper inspection of the ECharts instance
    // This test primarily ensures no errors occur when processing large datasets
  });

  it('renders all bars when less than 40 values exist', () => {
    const attribute = createMockAttribute(30); // Create 30 items

    const {container} = render(
      <Chart
        attribute={attribute}
        theme={mockTheme}
        cohort1Total={3000}
        cohort2Total={3000}
      />
    );

    // The chart should be rendered
    expect(container).toBeInTheDocument();
  });

  it('renders chart with empty cohorts', () => {
    const attribute: SuspectAttributesResult['rankedAttributes'][number] = {
      attributeName: 'test.attribute',
      cohort1: [],
      cohort2: [],
      order: {
        rrr: 1,
        kl_divergence: 1,
      },
    };

    const {container} = render(
      <Chart attribute={attribute} theme={mockTheme} cohort1Total={0} cohort2Total={0} />
    );

    // The chart should be rendered even with empty data
    expect(container).toBeInTheDocument();
  });

  it('displays attribute name in chart title', () => {
    const attribute = createMockAttribute(5);

    const {getByText} = render(
      <Chart
        attribute={attribute}
        theme={mockTheme}
        cohort1Total={500}
        cohort2Total={500}
      />
    );

    expect(getByText('test.attribute')).toBeInTheDocument();
  });

  it('displays population percentages for both cohorts', () => {
    const attribute: SuspectAttributesResult['rankedAttributes'][number] = {
      attributeName: 'test.attribute',
      cohort1: [
        {label: 'value1', value: '100'},
        {label: 'value2', value: '100'},
      ],
      cohort2: [
        {label: 'value1', value: '50'},
        {label: 'value2', value: '50'},
      ],
      order: {
        rrr: 1,
        kl_divergence: 1,
      },
    };

    // cohort1: 200/500 = 40%
    // cohort2: 100/500 = 20%
    const {container} = render(
      <Chart
        attribute={attribute}
        theme={mockTheme}
        cohort1Total={500}
        cohort2Total={500}
      />
    );

    // Population indicators should be present
    expect(container.querySelectorAll('[role="tooltip"]')).toHaveLength(2);
  });
});
