import {Fragment} from 'react';
import styled from '@emotion/styled';

import JSXNode from 'sentry/components/stories/jsxNode';
import JSXProperty from 'sentry/components/stories/jsxProperty';
import SideBySide from 'sentry/components/stories/sideBySide';
import SizingWindow from 'sentry/components/stories/sizingWindow';
import storyBook from 'sentry/stories/storyBook';
import {space} from 'sentry/styles/space';

import {BigNumberWidgetVisualization} from './bigNumberWidgetVisualization';

export default storyBook('BigNumberWidgetVisualization', story => {
  story('Getting Started', () => {
    return (
      <Fragment>
        <p>
          <JSXNode name="BigNumberWidgetVisualization" /> is a visualization used for "Big
          Number" widgets across the app. It displays a single large value. Used in places
          like Dashboards Big Number widgets, Project Details pages, and Organization
          Stats pages.
        </p>
        <p>
          It has features like:
          <ul>
            <li>intelligent value formatting</li>
            <li>auto-filling the parent</li>
            <li>full value shown in tooltip</li>
          </ul>
        </p>
        <p>
          You should use this component for showing large significant numbers in the UI!
          It's highly customizable, with features like previous period data comparison,
          thresholds, and more.
        </p>
      </Fragment>
    );
  });

  story('Basic Visualization', () => {
    return (
      <Fragment>
        <p>
          The visualization of <JSXNode name="BigNumberWidgetVisualiztion" /> a large
          number, just like it says on the tin. Depending on the value passed to it, it
          intelligently rounds and humanizes the results. If the number is humanized,
          hovering over the visualization shows a tooltip with the full value.
        </p>

        <p>
          <JSXNode name="BigNumberWidgetVisualization" /> also supports string values.
          This is not commonly used, but it's capable of rendering timestamps and in fact
          most fields defined in our field renderer pipeline
        </p>

        <SideBySide>
          <SmallSizingWindow>
            <Container>
              <BigNumberWidgetVisualization
                value={0.01087819860850493}
                field="eps()"
                meta={{
                  fields: {
                    'eps()': 'rate',
                  },
                  units: {
                    'eps()': '1/second',
                  },
                }}
                thresholds={{
                  max_values: {
                    max1: 1,
                    max2: 2,
                  },
                  unit: '1/second',
                }}
              />
            </Container>
          </SmallSizingWindow>
          <SmallSizingWindow>
            <Container>
              <BigNumberWidgetVisualization
                value={178451214}
                field="count()"
                meta={{
                  fields: {
                    'count()': 'integer',
                  },
                  units: {
                    'count()': null,
                  },
                }}
              />
            </Container>
          </SmallSizingWindow>
          <SmallSizingWindow>
            <Container>
              <BigNumberWidgetVisualization
                value={17.28}
                field="p95(span.duration)"
                meta={{
                  fields: {
                    'p95(span.duration)': 'duration',
                  },
                  units: {
                    'p95(spa.duration)': 'milliseconds',
                  },
                }}
              />
            </Container>
          </SmallSizingWindow>
          <SmallSizingWindow>
            <Container>
              <BigNumberWidgetVisualization
                value={'2024-10-17T16:08:07+00:00'}
                field="max(timestamp)"
                meta={{
                  fields: {
                    'max(timestamp)': 'date',
                  },
                  units: {
                    'max(timestamp)': null,
                  },
                }}
              />
            </Container>
          </SmallSizingWindow>
        </SideBySide>
      </Fragment>
    );
  });

  story('Maximum Value', () => {
    return (
      <Fragment>
        <p>
          The <code>maximumValue</code> prop allows setting the maximum displayable value.
          e.g., imagine a widget that displays a count. A count of more than a million is
          too expensive for the API to compute, so the API returns a maximum of 1,000,000.
          If the API returns exactly 1,000,000, that means the actual number is unknown,
          something higher than the max. Setting{' '}
          <JSXProperty name="maximumValue" value={1000000} /> will show &gt;1m.
        </p>
        <SideBySide>
          <SmallWidget>
            <BigNumberWidgetVisualization
              value={1000000}
              field="count()"
              maximumValue={1000000}
              meta={{
                fields: {
                  'count()': 'integer',
                },
                units: {},
              }}
            />
          </SmallWidget>
        </SideBySide>
      </Fragment>
    );
  });

  story('Previous Period Data', () => {
    return (
      <Fragment>
        <p>
          <JSXNode name="BigNumberWidgetVisualization" /> can show the difference of the
          current value and the previous period value as the difference between the two
          values, in small text next to the main value.
        </p>

        <p>
          The <code>preferredPolarity</code> prop controls the color of the comparison
          string. Setting <JSXProperty name="preferredPolarity" value={'+'} /> mean that a
          higher number is <i>better</i> and will paint increases in the value green. Vice
          versa with negative polarity. Omitting a preferred polarity will prevent
          colorization.
        </p>

        <SideBySide>
          <SmallWidget>
            <BigNumberWidgetVisualization
              value={17.1087819860850493}
              field="eps()"
              previousPeriodValue={15.0088607819850493}
              meta={{
                fields: {
                  'eps()': 'rate',
                },
                units: {
                  'eps()': '1/second',
                },
              }}
            />
          </SmallWidget>

          <SmallWidget>
            <BigNumberWidgetVisualization
              value={0.14227123}
              previousPeriodValue={0.1728139}
              field="http_rate(500)"
              preferredPolarity="-"
              meta={{
                fields: {
                  'http_rate(500)': 'percentage',
                },
                units: {},
              }}
            />
          </SmallWidget>
          <SmallWidget>
            <BigNumberWidgetVisualization
              field="http_rate(200)"
              value={0.14227123}
              previousPeriodValue={0.1728139}
              preferredPolarity="+"
              meta={{
                fields: {
                  'http_rate(200)': 'percentage',
                },
                units: {},
              }}
            />
          </SmallWidget>
        </SideBySide>
      </Fragment>
    );
  });

  story('Thresholds', () => {
    const meta = {
      fields: {
        'eps()': 'rate',
      },
      units: {
        'eps()': '1/second',
      },
    };

    const thresholds = {
      max_values: {
        max1: 20,
        max2: 50,
      },
      unit: '1/second',
    };

    return (
      <Fragment>
        <p>
          <JSXNode name="BigNumberWidgetVisualization" /> supports a{' '}
          <code>thresholds</code> prop. If specified, the value in the widget will be
          evaluated against these thresholds, and indicated using a colorful circle next
          to the value.
        </p>

        <SideBySide>
          <SmallWidget>
            <BigNumberWidgetVisualization
              value={7.1}
              field="eps()"
              meta={meta}
              thresholds={thresholds}
              preferredPolarity="+"
            />
          </SmallWidget>

          <SmallWidget>
            <BigNumberWidgetVisualization
              value={27.781}
              field="eps()"
              meta={meta}
              thresholds={thresholds}
              preferredPolarity="-"
            />
          </SmallWidget>

          <SmallWidget>
            <BigNumberWidgetVisualization
              field="eps()"
              value={78.1}
              meta={meta}
              thresholds={thresholds}
              preferredPolarity="+"
            />
          </SmallWidget>
        </SideBySide>

        <p>
          The thresholds respect the preferred polarity. By default, the preferred
          polarity is positive (higher numbers are good).
        </p>

        <SideBySide>
          <SmallWidget>
            <BigNumberWidgetVisualization
              field="eps()"
              value={7.1}
              meta={meta}
              thresholds={thresholds}
              preferredPolarity="-"
            />
          </SmallWidget>

          <SmallWidget>
            <BigNumberWidgetVisualization
              field="eps()"
              value={27.781}
              meta={meta}
              thresholds={thresholds}
              preferredPolarity="-"
            />
          </SmallWidget>

          <SmallWidget>
            <BigNumberWidgetVisualization
              field="eps()"
              value={78.1}
              meta={meta}
              thresholds={thresholds}
              preferredPolarity="-"
            />
          </SmallWidget>
        </SideBySide>
      </Fragment>
    );
  });
});

const SmallSizingWindow = styled(SizingWindow)`
  width: auto;
  height: 200px;
`;

interface SmallWidgetProps {
  children: React.ReactNode;
}
function SmallWidget(props: SmallWidgetProps) {
  return (
    <Padded>
      <Container>{props.children}</Container>
    </Padded>
  );
}

const Padded = styled('div')`
  border-radius: ${p => p.theme.borderRadius};
  border: ${p => `1px solid ${p.theme.border}`};
  padding: ${space(2)} ${space(1)};
  width: 250px;
  height: 80px;
`;

const Container = styled('div')`
  width: 100%;
  height: 100%;
  position: relative;
`;
