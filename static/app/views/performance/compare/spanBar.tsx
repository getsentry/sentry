import * as React from 'react';
import {withTheme} from '@emotion/react';
import styled from '@emotion/styled';

import Count from 'app/components/count';
import * as DividerHandlerManager from 'app/components/events/interfaces/spans/dividerHandlerManager';
import {TreeDepthType} from 'app/components/events/interfaces/spans/types';
import {
  isOrphanTreeDepth,
  unwrapTreeDepth,
} from 'app/components/events/interfaces/spans/utils';
import {ROW_HEIGHT, ROW_PADDING} from 'app/components/performance/waterfall/constants';
import {Row, RowCell, RowCellContainer} from 'app/components/performance/waterfall/row';
import {
  DividerLine,
  DividerLineGhostContainer,
} from 'app/components/performance/waterfall/rowDivider';
import {RowTitle, RowTitleContainer} from 'app/components/performance/waterfall/rowTitle';
import {
  ConnectorBar,
  StyledIconChevron,
  TOGGLE_BORDER_BOX,
  TreeConnector,
  TreeToggle,
  TreeToggleContainer,
} from 'app/components/performance/waterfall/treeConnector';
import {
  getBackgroundColor,
  getHatchPattern,
  getHumanDuration,
  toPercent,
} from 'app/components/performance/waterfall/utils';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Theme} from 'app/utils/theme';

import SpanDetail from './spanDetail';
import {SpanBarRectangle} from './styles';
import {
  DiffSpanType,
  generateCSSWidth,
  getSpanDescription,
  getSpanDuration,
  getSpanID,
  getSpanOperation,
  isOrphanDiffSpan,
  SpanGeneratedBoundsType,
} from './utils';

type Props = {
  theme: Theme;
  span: Readonly<DiffSpanType>;
  treeDepth: number;
  continuingTreeDepths: Array<TreeDepthType>;
  spanNumber: number;
  numOfSpanChildren: number;
  isRoot: boolean;
  isLast: boolean;
  showSpanTree: boolean;
  toggleSpanTree: () => void;
  generateBounds: (span: DiffSpanType) => SpanGeneratedBoundsType;
};

type State = {
  showDetail: boolean;
};

class SpanBar extends React.Component<Props, State> {
  state: State = {
    showDetail: false,
  };

  renderSpanTreeConnector({hasToggler}: {hasToggler: boolean}) {
    const {
      isLast,
      isRoot,
      treeDepth: spanTreeDepth,
      continuingTreeDepths,
      span,
      showSpanTree,
    } = this.props;

    const spanID = getSpanID(span);

    if (isRoot) {
      if (hasToggler) {
        return (
          <ConnectorBar
            style={{right: '16px', height: '10px', bottom: '-5px', top: 'auto'}}
            key={`${spanID}-last`}
            orphanBranch={false}
          />
        );
      }

      return null;
    }

    const connectorBars: Array<React.ReactNode> = continuingTreeDepths.map(treeDepth => {
      const depth: number = unwrapTreeDepth(treeDepth);

      if (depth === 0) {
        // do not render a connector bar at depth 0,
        // if we did render a connector bar, this bar would be placed at depth -1
        // which does not exist.
        return null;
      }
      const left = ((spanTreeDepth - depth) * (TOGGLE_BORDER_BOX / 2) + 1) * -1;

      return (
        <ConnectorBar
          style={{left}}
          key={`${spanID}-${depth}`}
          orphanBranch={isOrphanTreeDepth(treeDepth)}
        />
      );
    });

    if (hasToggler && showSpanTree) {
      // if there is a toggle button, we add a connector bar to create an attachment
      // between the toggle button and any connector bars below the toggle button
      connectorBars.push(
        <ConnectorBar
          style={{
            right: '16px',
            height: '10px',
            bottom: isLast ? `-${ROW_HEIGHT / 2}px` : '0',
            top: 'auto',
          }}
          key={`${spanID}-last`}
          orphanBranch={false}
        />
      );
    }

    return (
      <TreeConnector
        isLast={isLast}
        hasToggler={hasToggler}
        orphanBranch={isOrphanDiffSpan(span)}
      >
        {connectorBars}
      </TreeConnector>
    );
  }

  renderSpanTreeToggler({left}: {left: number}) {
    const {numOfSpanChildren, isRoot, showSpanTree} = this.props;

    const chevron = <StyledIconChevron direction={showSpanTree ? 'up' : 'down'} />;

    if (numOfSpanChildren <= 0) {
      return (
        <TreeToggleContainer style={{left: `${left}px`}}>
          {this.renderSpanTreeConnector({hasToggler: false})}
        </TreeToggleContainer>
      );
    }

    const chevronElement = !isRoot ? <div>{chevron}</div> : null;

    return (
      <TreeToggleContainer style={{left: `${left}px`}} hasToggler>
        {this.renderSpanTreeConnector({hasToggler: true})}
        <TreeToggle
          disabled={!!isRoot}
          isExpanded={this.props.showSpanTree}
          errored={false}
          onClick={event => {
            event.stopPropagation();

            if (isRoot) {
              return;
            }

            this.props.toggleSpanTree();
          }}
        >
          <Count value={numOfSpanChildren} />
          {chevronElement}
        </TreeToggle>
      </TreeToggleContainer>
    );
  }

  renderTitle() {
    const {span, treeDepth} = this.props;

    const operationName = getSpanOperation(span) ? (
      <strong>
        {getSpanOperation(span)}
        {' \u2014 '}
      </strong>
    ) : (
      ''
    );

    const description =
      getSpanDescription(span) ??
      (span.comparisonResult === 'matched' ? t('matched') : getSpanID(span));

    const left = treeDepth * (TOGGLE_BORDER_BOX / 2);

    return (
      <RowTitleContainer>
        {this.renderSpanTreeToggler({left})}
        <RowTitle
          style={{
            left: `${left}px`,
            width: '100%',
          }}
        >
          <span>
            {operationName}
            {description}
          </span>
        </RowTitle>
      </RowTitleContainer>
    );
  }

  renderDivider = (
    dividerHandlerChildrenProps: DividerHandlerManager.DividerHandlerManagerChildrenProps
  ) => {
    const {theme} = this.props;
    if (this.state.showDetail) {
      // Mock component to preserve layout spacing
      return (
        <DividerLine
          style={{
            position: 'relative',
            backgroundColor: getBackgroundColor({
              theme,
              showDetail: true,
            }),
          }}
        />
      );
    }

    const {addDividerLineRef} = dividerHandlerChildrenProps;

    return (
      <DividerLine
        ref={addDividerLineRef()}
        style={{
          position: 'relative',
        }}
        onMouseEnter={() => {
          dividerHandlerChildrenProps.setHover(true);
        }}
        onMouseLeave={() => {
          dividerHandlerChildrenProps.setHover(false);
        }}
        onMouseOver={() => {
          dividerHandlerChildrenProps.setHover(true);
        }}
        onMouseDown={dividerHandlerChildrenProps.onDragStart}
        onClick={event => {
          // we prevent the propagation of the clicks from this component to prevent
          // the span detail from being opened.
          event.stopPropagation();
        }}
      />
    );
  };

  getSpanBarStyles() {
    const {theme, span, generateBounds} = this.props;

    const bounds = generateBounds(span);

    function normalizePadding(width: string | undefined): string | undefined {
      if (!width) {
        return undefined;
      }
      return `max(1px, ${width})`;
    }

    switch (span.comparisonResult) {
      case 'matched': {
        const baselineDuration = getSpanDuration(span.baselineSpan);
        const regressionDuration = getSpanDuration(span.regressionSpan);

        if (baselineDuration === regressionDuration) {
          return {
            background: {
              color: undefined,
              width: normalizePadding(generateCSSWidth(bounds.background)),
              hatch: true,
            },
            foreground: undefined,
          };
        }

        if (baselineDuration > regressionDuration) {
          return {
            background: {
              // baseline
              color: theme.textColor,
              width: normalizePadding(generateCSSWidth(bounds.background)),
            },
            foreground: {
              // regression
              color: undefined,
              width: normalizePadding(generateCSSWidth(bounds.foreground)),
              hatch: true,
            },
          };
        }

        // case: baselineDuration < regressionDuration

        return {
          background: {
            // regression
            color: theme.purple200,
            width: normalizePadding(generateCSSWidth(bounds.background)),
          },
          foreground: {
            // baseline
            color: undefined,
            width: normalizePadding(generateCSSWidth(bounds.foreground)),
            hatch: true,
          },
        };
      }
      case 'regression': {
        return {
          background: {
            color: theme.purple200,
            width: normalizePadding(generateCSSWidth(bounds.background)),
          },
          foreground: undefined,
        };
      }
      case 'baseline': {
        return {
          background: {
            color: theme.textColor,
            width: normalizePadding(generateCSSWidth(bounds.background)),
          },
          foreground: undefined,
        };
      }
      default: {
        const _exhaustiveCheck: never = span;
        return _exhaustiveCheck;
      }
    }
  }

  renderComparisonReportLabel() {
    const {span} = this.props;

    switch (span.comparisonResult) {
      case 'matched': {
        const baselineDuration = getSpanDuration(span.baselineSpan);
        const regressionDuration = getSpanDuration(span.regressionSpan);

        let label;

        if (baselineDuration === regressionDuration) {
          label = <ComparisonLabel>{t('No change')}</ComparisonLabel>;
        }

        if (baselineDuration > regressionDuration) {
          const duration = getHumanDuration(
            Math.abs(baselineDuration - regressionDuration)
          );

          label = (
            <NotableComparisonLabel>{t('- %s faster', duration)}</NotableComparisonLabel>
          );
        }

        if (baselineDuration < regressionDuration) {
          const duration = getHumanDuration(
            Math.abs(baselineDuration - regressionDuration)
          );

          label = (
            <NotableComparisonLabel>{t('+ %s slower', duration)}</NotableComparisonLabel>
          );
        }

        return label;
      }
      case 'baseline': {
        return <ComparisonLabel>{t('Only in baseline')}</ComparisonLabel>;
      }
      case 'regression': {
        return <ComparisonLabel>{t('Only in this event')}</ComparisonLabel>;
      }
      default: {
        const _exhaustiveCheck: never = span;
        return _exhaustiveCheck;
      }
    }
  }

  renderHeader(
    dividerHandlerChildrenProps: DividerHandlerManager.DividerHandlerManagerChildrenProps
  ) {
    const {dividerPosition, addGhostDividerLineRef} = dividerHandlerChildrenProps;
    const {spanNumber, span} = this.props;

    const isMatched = span.comparisonResult === 'matched';
    const hideSpanBarColumn = this.state.showDetail && isMatched;

    const spanBarStyles = this.getSpanBarStyles();

    const foregroundSpanBar = spanBarStyles.foreground ? (
      <ComparisonSpanBarRectangle
        spanBarHatch={spanBarStyles.foreground.hatch ?? false}
        style={{
          backgroundColor: spanBarStyles.foreground.color,
          width: spanBarStyles.foreground.width,
          display: hideSpanBarColumn ? 'none' : 'block',
        }}
      />
    ) : null;
    return (
      <RowCellContainer showDetail={this.state.showDetail}>
        <RowCell
          data-type="span-row-cell"
          showDetail={this.state.showDetail}
          style={{
            width: `calc(${toPercent(dividerPosition)} - 0.5px)`,
          }}
          onClick={() => {
            this.toggleDisplayDetail();
          }}
        >
          {this.renderTitle()}
        </RowCell>
        {this.renderDivider(dividerHandlerChildrenProps)}
        <RowCell
          data-type="span-row-cell"
          showDetail={this.state.showDetail}
          showStriping={spanNumber % 2 !== 0}
          style={{
            width: `calc(${toPercent(1 - dividerPosition)} - 0.5px)`,
          }}
          onClick={() => {
            this.toggleDisplayDetail();
          }}
        >
          <SpanContainer>
            <ComparisonSpanBarRectangle
              spanBarHatch={spanBarStyles.background.hatch ?? false}
              style={{
                backgroundColor: spanBarStyles.background.color,
                width: spanBarStyles.background.width,
                display: hideSpanBarColumn ? 'none' : 'block',
              }}
            />
            {foregroundSpanBar}
          </SpanContainer>
          {this.renderComparisonReportLabel()}
        </RowCell>
        {!this.state.showDetail && (
          <DividerLineGhostContainer
            style={{
              width: `calc(${toPercent(dividerPosition)} + 0.5px)`,
              display: 'none',
            }}
          >
            <DividerLine
              ref={addGhostDividerLineRef()}
              style={{
                right: 0,
              }}
              className="hovering"
              onClick={event => {
                // the ghost divider line should not be interactive.
                // we prevent the propagation of the clicks from this component to prevent
                // the span detail from being opened.
                event.stopPropagation();
              }}
            />
          </DividerLineGhostContainer>
        )}
      </RowCellContainer>
    );
  }

  toggleDisplayDetail = () => {
    this.setState(state => ({
      showDetail: !state.showDetail,
    }));
  };

  renderDetail() {
    if (!this.state.showDetail) {
      return null;
    }

    const {span, generateBounds} = this.props;

    return <SpanDetail span={this.props.span} bounds={generateBounds(span)} />;
  }

  render() {
    return (
      <Row visible data-test-id="span-row">
        <DividerHandlerManager.Consumer>
          {(
            dividerHandlerChildrenProps: DividerHandlerManager.DividerHandlerManagerChildrenProps
          ) => this.renderHeader(dividerHandlerChildrenProps)}
        </DividerHandlerManager.Consumer>
        {this.renderDetail()}
      </Row>
    );
  }
}

const ComparisonSpanBarRectangle = styled(SpanBarRectangle)<{spanBarHatch: boolean}>`
  position: absolute;
  left: 0;
  height: 16px;
  ${p => getHatchPattern(p, p.theme.purple200, p.theme.gray500)}
`;

const ComparisonLabel = styled('div')`
  position: absolute;
  user-select: none;
  right: ${space(1)};
  line-height: ${ROW_HEIGHT - 2 * ROW_PADDING}px;
  top: ${ROW_PADDING}px;
  font-size: ${p => p.theme.fontSizeExtraSmall};
`;

const SpanContainer = styled('div')`
  position: relative;
  margin-right: 120px;
`;

const NotableComparisonLabel = styled(ComparisonLabel)`
  font-weight: bold;
`;

export default withTheme(SpanBar);
