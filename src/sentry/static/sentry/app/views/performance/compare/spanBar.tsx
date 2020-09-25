import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import theme from 'app/utils/theme';
import space from 'app/styles/space';
import Count from 'app/components/count';
import {TreeDepthType} from 'app/components/events/interfaces/spans/types';
import {SPAN_ROW_HEIGHT, SpanRow} from 'app/components/events/interfaces/spans/styles';
import {
  TOGGLE_BORDER_BOX,
  SpanRowCellContainer,
  SpanRowCell,
  SpanBarTitleContainer,
  SpanBarTitle,
  OperationName,
  StyledIconChevron,
  SpanTreeTogglerContainer,
  ConnectorBar,
  SpanTreeConnector,
  SpanTreeToggler,
  DividerLine,
  DividerLineGhostContainer,
  getBackgroundColor,
} from 'app/components/events/interfaces/spans/spanBar';
import {
  toPercent,
  unwrapTreeDepth,
  isOrphanTreeDepth,
  getHumanDuration,
} from 'app/components/events/interfaces/spans/utils';
import * as DividerHandlerManager from 'app/components/events/interfaces/spans/dividerHandlerManager';

import {
  DiffSpanType,
  getSpanID,
  getSpanOperation,
  getSpanDescription,
  isOrphanDiffSpan,
  SpanGeneratedBoundsType,
  getSpanDuration,
  generateCSSWidth,
} from './utils';
import {SpanBarRectangle} from './styles';
import SpanDetail from './spanDetail';

type Props = {
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
            bottom: isLast ? `-${SPAN_ROW_HEIGHT / 2}px` : '0',
            top: 'auto',
          }}
          key={`${spanID}-last`}
          orphanBranch={false}
        />
      );
    }

    return (
      <SpanTreeConnector
        isLast={isLast}
        hasToggler={hasToggler}
        orphanBranch={isOrphanDiffSpan(span)}
      >
        {connectorBars}
      </SpanTreeConnector>
    );
  }

  renderSpanTreeToggler({left}: {left: number}) {
    const {numOfSpanChildren, isRoot, showSpanTree} = this.props;

    const chevron = <StyledIconChevron direction={showSpanTree ? 'up' : 'down'} />;

    if (numOfSpanChildren <= 0) {
      return (
        <SpanTreeTogglerContainer style={{left: `${left}px`}}>
          {this.renderSpanTreeConnector({hasToggler: false})}
        </SpanTreeTogglerContainer>
      );
    }

    const chevronElement = !isRoot ? <div>{chevron}</div> : null;

    return (
      <SpanTreeTogglerContainer style={{left: `${left}px`}} hasToggler>
        {this.renderSpanTreeConnector({hasToggler: true})}
        <SpanTreeToggler
          disabled={!!isRoot}
          isExpanded={this.props.showSpanTree}
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
        </SpanTreeToggler>
      </SpanTreeTogglerContainer>
    );
  }

  renderTitle() {
    const {span, treeDepth} = this.props;

    const operationName = getSpanOperation(span) ? (
      <strong>
        <OperationName spanErrors={[]}>{getSpanOperation(span)}</OperationName>
        {` \u2014 `}
      </strong>
    ) : (
      ''
    );

    const description =
      getSpanDescription(span) ??
      (span.comparisonResult === 'matched' ? t('matched') : getSpanID(span));

    const left = treeDepth * (TOGGLE_BORDER_BOX / 2);

    return (
      <SpanBarTitleContainer>
        {this.renderSpanTreeToggler({left})}
        <SpanBarTitle
          style={{
            left: `${left}px`,
            width: '100%',
          }}
        >
          <span>
            {operationName}
            {description}
          </span>
        </SpanBarTitle>
      </SpanBarTitleContainer>
    );
  }

  renderDivider = (
    dividerHandlerChildrenProps: DividerHandlerManager.DividerHandlerManagerChildrenProps
  ) => {
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
    const {span, generateBounds} = this.props;

    const bounds = generateBounds(span);

    function normalizePadding(width: string | undefined): string | undefined {
      if (!width) {
        return undefined;
      }

      // there is a "padding" of 1px on either side of the span rectangle
      return `max(1px, calc(${width} - 2px))`;
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
              color: theme.gray700,
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
            color: theme.purple300,
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
            color: theme.purple300,
            width: normalizePadding(generateCSSWidth(bounds.background)),
          },
          foreground: undefined,
        };
      }
      case 'baseline': {
        return {
          background: {
            color: theme.gray700,
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
      <SpanRowCellContainer showDetail={this.state.showDetail}>
        <SpanRowCell
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
        </SpanRowCell>
        {this.renderDivider(dividerHandlerChildrenProps)}
        <SpanRowCell
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
        </SpanRowCell>
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
      </SpanRowCellContainer>
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
      <SpanRow visible data-test-id="span-row">
        <DividerHandlerManager.Consumer>
          {(
            dividerHandlerChildrenProps: DividerHandlerManager.DividerHandlerManagerChildrenProps
          ) => this.renderHeader(dividerHandlerChildrenProps)}
        </DividerHandlerManager.Consumer>
        {this.renderDetail()}
      </SpanRow>
    );
  }
}

const getHatchPattern = ({spanBarHatch}) => {
  if (spanBarHatch === true) {
    return `
        background-image: linear-gradient(135deg, #9f92fa 33.33%, #302839 33.33%, #302839 50%, #9f92fa 50%, #9f92fa 83.33%, #302839 83.33%, #302839 100%);
        background-size: 4.24px 4.24px;
    `;
  }

  return null;
};

const ComparisonSpanBarRectangle = styled(SpanBarRectangle)`
  position: absolute;
  left: 0;
  height: 16px;
  ${getHatchPattern};
`;

const ComparisonLabel = styled('div')`
  position: absolute;
  user-select: none;
  right: ${space(1)};
  line-height: 16px;
  font-size: ${p => p.theme.fontSizeExtraSmall};
`;

const SpanContainer = styled('div')`
  position: relative;
  margin-right: 120px;
`;

const NotableComparisonLabel = styled(ComparisonLabel)`
  font-weight: bold;
`;

export default SpanBar;
