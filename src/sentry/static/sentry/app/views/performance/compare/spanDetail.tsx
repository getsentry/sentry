import * as React from 'react';
import styled from '@emotion/styled';

import theme from 'app/utils/theme';
import {t} from 'app/locale';
import space from 'app/styles/space';
import getDynamicText from 'app/utils/getDynamicText';
import DateTime from 'app/components/dateTime';
import Pill from 'app/components/pill';
import Pills from 'app/components/pills';
import {SpanDetailContainer} from 'app/components/events/interfaces/spans/spanDetail';
import {SpanType, rawSpanKeys} from 'app/components/events/interfaces/spans/types';
import {getHumanDuration} from 'app/components/events/interfaces/spans/utils';

import {
  DiffSpanType,
  SpanGeneratedBoundsType,
  generateCSSWidth,
  SpanWidths,
  getSpanDuration,
} from './utils';
import {SpanBarRectangle} from './styles';
import SpanDetailContent from './spanDetailContent';

type DurationDisplay = 'right' | 'inset';

const getDurationDisplay = (width: SpanWidths | undefined): DurationDisplay => {
  if (!width) {
    return 'right';
  }

  switch (width.type) {
    case 'WIDTH_PIXEL': {
      return 'right';
    }
    case 'WIDTH_PERCENTAGE': {
      const spaceNeeded = 0.3;

      if (width.width < 1 - spaceNeeded) {
        return 'right';
      }

      return 'inset';
    }
    default: {
      const _exhaustiveCheck: never = width;
      return _exhaustiveCheck;
    }
  }
};

type Props = {
  span: Readonly<DiffSpanType>;
  bounds: SpanGeneratedBoundsType;
};

class SpanDetail extends React.Component<Props> {
  renderContent() {
    const {span, bounds} = this.props;

    switch (span.comparisonResult) {
      case 'matched': {
        return (
          <MatchedSpanDetailsContent
            baselineSpan={span.baselineSpan}
            regressionSpan={span.regressionSpan}
            bounds={bounds}
          />
        );
      }
      case 'regression': {
        return <SpanDetailContent span={span.regressionSpan} />;
      }
      case 'baseline': {
        return <SpanDetailContent span={span.baselineSpan} />;
      }
      default: {
        const _exhaustiveCheck: never = span;
        return _exhaustiveCheck;
      }
    }
  }

  render() {
    return (
      <SpanDetailContainer
        onClick={event => {
          // prevent toggling the span detail
          event.stopPropagation();
        }}
      >
        {this.renderContent()}
      </SpanDetailContainer>
    );
  }
}

const MatchedSpanDetailsContent = (props: {
  baselineSpan: SpanType;
  regressionSpan: SpanType;
  bounds: SpanGeneratedBoundsType;
}) => {
  const {baselineSpan, regressionSpan, bounds} = props;

  const dataKeys = new Set([
    ...Object.keys(baselineSpan?.data ?? {}),
    ...Object.keys(regressionSpan?.data ?? {}),
  ]);

  const unknownKeys = new Set([
    ...Object.keys(baselineSpan).filter(key => {
      return !rawSpanKeys.has(key as any);
    }),
    ...Object.keys(regressionSpan).filter(key => {
      return !rawSpanKeys.has(key as any);
    }),
  ]);

  return (
    <div>
      <SpanBars
        bounds={bounds}
        baselineSpan={baselineSpan}
        regressionSpan={regressionSpan}
      />
      <Row
        baselineTitle={t('Baseline Span ID')}
        regressionTitle={t("This Event's Span ID")}
        renderBaselineContent={() => baselineSpan.span_id}
        renderRegressionContent={() => regressionSpan.span_id}
      />
      <Row
        title={t('Parent Span ID')}
        renderBaselineContent={() => baselineSpan.parent_span_id || ''}
        renderRegressionContent={() => regressionSpan.parent_span_id || ''}
      />
      <Row
        title={t('Trace ID')}
        renderBaselineContent={() => baselineSpan.trace_id}
        renderRegressionContent={() => regressionSpan.trace_id}
      />
      <Row
        title={t('Description')}
        renderBaselineContent={() => baselineSpan.description ?? ''}
        renderRegressionContent={() => regressionSpan.description ?? ''}
      />
      <Row
        title={t('Start Date')}
        renderBaselineContent={() =>
          getDynamicText({
            fixed: 'Mar 16, 2020 9:10:12 AM UTC',
            value: (
              <React.Fragment>
                <DateTime date={baselineSpan.start_timestamp * 1000} />
                {` (${baselineSpan.start_timestamp})`}
              </React.Fragment>
            ),
          })
        }
        renderRegressionContent={() =>
          getDynamicText({
            fixed: 'Mar 16, 2020 9:10:12 AM UTC',
            value: (
              <React.Fragment>
                <DateTime date={regressionSpan.start_timestamp * 1000} />
                {` (${baselineSpan.start_timestamp})`}
              </React.Fragment>
            ),
          })
        }
      />
      <Row
        title={t('End Date')}
        renderBaselineContent={() =>
          getDynamicText({
            fixed: 'Mar 16, 2020 9:10:12 AM UTC',
            value: (
              <React.Fragment>
                <DateTime date={baselineSpan.timestamp * 1000} />
                {` (${baselineSpan.timestamp})`}
              </React.Fragment>
            ),
          })
        }
        renderRegressionContent={() =>
          getDynamicText({
            fixed: 'Mar 16, 2020 9:10:12 AM UTC',
            value: (
              <React.Fragment>
                <DateTime date={regressionSpan.timestamp * 1000} />
                {` (${regressionSpan.timestamp})`}
              </React.Fragment>
            ),
          })
        }
      />
      <Row
        title={t('Duration')}
        renderBaselineContent={() => {
          const startTimestamp: number = baselineSpan.start_timestamp;
          const endTimestamp: number = baselineSpan.timestamp;

          const duration = (endTimestamp - startTimestamp) * 1000;
          return `${duration.toFixed(3)}ms`;
        }}
        renderRegressionContent={() => {
          const startTimestamp: number = regressionSpan.start_timestamp;
          const endTimestamp: number = regressionSpan.timestamp;

          const duration = (endTimestamp - startTimestamp) * 1000;
          return `${duration.toFixed(3)}ms`;
        }}
      />
      <Row
        title={t('Operation')}
        renderBaselineContent={() => baselineSpan.op || ''}
        renderRegressionContent={() => regressionSpan.op || ''}
      />
      <Row
        title={t('Same Process as Parent')}
        renderBaselineContent={() => String(!!baselineSpan.same_process_as_parent)}
        renderRegressionContent={() => String(!!regressionSpan.same_process_as_parent)}
      />
      <Tags baselineSpan={baselineSpan} regressionSpan={regressionSpan} />
      {Array.from(dataKeys).map((dataTitle: string) => (
        <Row
          key={dataTitle}
          title={dataTitle}
          renderBaselineContent={() => {
            const data = baselineSpan?.data ?? {};
            const value: string | undefined = data[dataTitle];

            return JSON.stringify(value, null, 4) || '';
          }}
          renderRegressionContent={() => {
            const data = regressionSpan?.data ?? {};
            const value: string | undefined = data[dataTitle];

            return JSON.stringify(value, null, 4) || '';
          }}
        />
      ))}
      {Array.from(unknownKeys).map(key => (
        <Row
          key={key}
          title={key}
          renderBaselineContent={() => {
            return JSON.stringify(baselineSpan[key], null, 4) || '';
          }}
          renderRegressionContent={() => {
            return JSON.stringify(regressionSpan[key], null, 4) || '';
          }}
        />
      ))}
    </div>
  );
};

const RowSplitter = styled('div')`
  display: flex;
  flex-direction: row;

  > * + * {
    border-left: 1px solid ${p => p.theme.borderDark};
  }
`;

const SpanBarContainer = styled('div')`
  position: relative;
  height: 16px;
  margin-top: ${space(3)};
  margin-bottom: ${space(2)};
`;

const SpanBars = (props: {
  bounds: SpanGeneratedBoundsType;
  baselineSpan: SpanType;
  regressionSpan: SpanType;
}) => {
  const {bounds, baselineSpan, regressionSpan} = props;

  const baselineDurationDisplay = getDurationDisplay(bounds.baseline);
  const regressionDurationDisplay = getDurationDisplay(bounds.regression);

  return (
    <RowSplitter>
      <RowContainer>
        <SpanBarContainer>
          <SpanBarRectangle
            style={{
              backgroundColor: theme.gray700,
              width: generateCSSWidth(bounds.baseline),
              position: 'absolute',
              height: '16px',
            }}
          >
            <DurationPill
              durationDisplay={baselineDurationDisplay}
              fontColors={{right: theme.gray700, inset: theme.white}}
            >
              {getHumanDuration(getSpanDuration(baselineSpan))}
            </DurationPill>
          </SpanBarRectangle>
        </SpanBarContainer>
      </RowContainer>
      <RowContainer>
        <SpanBarContainer>
          <SpanBarRectangle
            style={{
              backgroundColor: theme.purple300,
              width: generateCSSWidth(bounds.regression),
              position: 'absolute',
              height: '16px',
            }}
          >
            <DurationPill
              durationDisplay={regressionDurationDisplay}
              fontColors={{right: theme.gray700, inset: theme.gray700}}
            >
              {getHumanDuration(getSpanDuration(regressionSpan))}
            </DurationPill>
          </SpanBarRectangle>
        </SpanBarContainer>
      </RowContainer>
    </RowSplitter>
  );
};

const Row = (props: {
  title?: string;
  baselineTitle?: string;
  regressionTitle?: string;

  renderBaselineContent: () => React.ReactNode;
  renderRegressionContent: () => React.ReactNode;
}) => {
  const {title, baselineTitle, regressionTitle} = props;

  const baselineContent = props.renderBaselineContent();
  const regressionContent = props.renderRegressionContent();

  if (!baselineContent && !regressionContent) {
    return null;
  }

  return (
    <RowSplitter>
      <RowCell title={baselineTitle ?? title ?? ''}>{baselineContent}</RowCell>
      <RowCell title={regressionTitle ?? title ?? ''}>{regressionContent}</RowCell>
    </RowSplitter>
  );
};

const RowContainer = styled('div')`
  width: 50%;
  min-width: 50%;
  max-width: 50%;
  flex-basis: 50%;

  padding-left: ${space(2)};
  padding-right: ${space(2)};
`;

const RowTitle = styled('div')`
  font-size: 13px;
  font-weight: 600;
`;

const RowCell = ({title, children}: {title: string; children: React.ReactNode}) => {
  return (
    <RowContainer>
      <RowTitle>{title}</RowTitle>
      <div>
        <pre className="val" style={{marginBottom: space(1)}}>
          <span className="val-string">{children}</span>
        </pre>
      </div>
    </RowContainer>
  );
};

const getTags = (span: SpanType) => {
  const tags: {[tag_name: string]: string} | undefined = span?.tags;

  if (!tags) {
    return undefined;
  }

  const keys = Object.keys(tags);

  if (keys.length <= 0) {
    return undefined;
  }

  return tags;
};

const TagPills = ({tags}: {tags: {[tag_name: string]: string} | undefined}) => {
  if (!tags) {
    return null;
  }

  const keys = Object.keys(tags);

  if (keys.length <= 0) {
    return null;
  }

  return (
    <Pills>
      {keys.map((key, index) => (
        <Pill key={index} name={key} value={String(tags[key]) || ''} />
      ))}
    </Pills>
  );
};

const Tags = ({
  baselineSpan,
  regressionSpan,
}: {
  baselineSpan: SpanType;
  regressionSpan: SpanType;
}) => {
  const baselineTags = getTags(baselineSpan);
  const regressionTags = getTags(regressionSpan);

  if (!baselineTags && !regressionTags) {
    return null;
  }

  return (
    <RowSplitter>
      <RowContainer>
        <RowTitle>{t('Tags')}</RowTitle>
        <div>
          <TagPills tags={baselineTags} />
        </div>
      </RowContainer>
      <RowContainer>
        <RowTitle>{t('Tags')}</RowTitle>
        <div>
          <TagPills tags={regressionTags} />
        </div>
      </RowContainer>
    </RowSplitter>
  );
};

const DurationPill = styled('div')<{
  durationDisplay: DurationDisplay;
  fontColors: {right: string; inset: string};
}>`
  position: absolute;
  top: 50%;
  display: flex;
  align-items: center;
  transform: translateY(-50%);
  white-space: nowrap;
  font-size: ${p => p.theme.fontSizeExtraSmall};
  color: ${p => p.fontColors.right};

  ${p => {
    switch (p.durationDisplay) {
      case 'right':
        return `left: calc(100% + ${space(0.75)});`;
      default:
        return `
          right: ${space(0.75)};
          color: ${p.fontColors.inset};
        `;
    }
  }};

  @media (max-width: ${p => p.theme.breakpoints[1]}) {
    font-size: 10px;
  }
`;

export default SpanDetail;
