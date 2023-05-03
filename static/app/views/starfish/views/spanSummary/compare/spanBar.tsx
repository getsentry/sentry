import React from 'react';
import styled from '@emotion/styled';

import Count from 'sentry/components/count';
import * as DividerHandlerManager from 'sentry/components/events/interfaces/spans/dividerHandlerManager';
import {TreeDepthType} from 'sentry/components/events/interfaces/spans/types';
import {
  isOrphanTreeDepth,
  unwrapTreeDepth,
} from 'sentry/components/events/interfaces/spans/utils';
import {
  Row,
  RowCell,
  RowCellContainer,
} from 'sentry/components/performance/waterfall/row';
import {
  DividerLine,
  DividerLineGhostContainer,
} from 'sentry/components/performance/waterfall/rowDivider';
import {
  RowTitle,
  RowTitleContainer,
} from 'sentry/components/performance/waterfall/rowTitle';
import {
  ConnectorBar,
  TOGGLE_BORDER_BOX,
  TreeConnector,
  TreeToggle,
  TreeToggleContainer,
} from 'sentry/components/performance/waterfall/treeConnector';
import {getHumanDuration, toPercent} from 'sentry/components/performance/waterfall/utils';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import theme from 'sentry/utils/theme';

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
  continuingTreeDepths: Array<TreeDepthType>;
  generateBounds: (span: DiffSpanType) => SpanGeneratedBoundsType;
  isLast: boolean;
  isRoot: boolean;
  numOfSpanChildren: number;
  showSpanTree: boolean;
  span: Readonly<DiffSpanType>;
  spanNumber: number;
  toggleSpanTree: () => void;
  treeDepth: number;
};

class SpanBar extends React.Component<Props> {
  renderTreeConnector({hasToggler}: {hasToggler: boolean}) {
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
            bottom: isLast ? `-${50 / 2}px` : '0',
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

    const chevron = <IconChevron direction={showSpanTree ? 'up' : 'down'} />;

    if (numOfSpanChildren <= 0) {
      return (
        <TreeToggleContainer style={{left: `${left}px`}}>
          {this.renderTreeConnector({hasToggler: false})}
        </TreeToggleContainer>
      );
    }

    const chevronElement = !isRoot ? <div>{chevron}</div> : null;

    return (
      <TreeToggleContainer style={{left: `${left}px`}} hasToggler>
        {this.renderTreeConnector({hasToggler: true})}
        <TreeToggle
          disabled={!!isRoot}
          isExpanded={this.props.showSpanTree}
          onClick={event => {
            event.stopPropagation();

            if (isRoot) {
              return;
            }

            this.props.toggleSpanTree();
          }}
          errored={false}
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
        <span>{getSpanOperation(span)}</span>
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
              color: theme.gray500,
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
            color: theme.gray500,
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

        let label: string = '';

        if (baselineDuration === regressionDuration) {
          label = 'no change';
        }

        if (baselineDuration > regressionDuration) {
          const duration = getHumanDuration(
            Math.abs(baselineDuration - regressionDuration)
          );

          label = t('- %s faster', duration);
        }

        if (baselineDuration < regressionDuration) {
          const duration = getHumanDuration(
            Math.abs(baselineDuration - regressionDuration)
          );

          label = t('+ %s slower', duration);
        }

        return <ComparisonReportLabelContainer>{label}</ComparisonReportLabelContainer>;
      }
      case 'baseline': {
        return (
          <ComparisonReportLabelContainer>
            {t('removed from baseline')}
          </ComparisonReportLabelContainer>
        );
      }
      case 'regression': {
        return (
          <ComparisonReportLabelContainer>
            {t('missing from regression')}
          </ComparisonReportLabelContainer>
        );
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
    const {spanNumber} = this.props;

    const spanBarStyles = this.getSpanBarStyles();

    const foregroundSpanBar = spanBarStyles.foreground ? (
      <ComparisonSpanBarRectangle
        spanBarHatch={spanBarStyles.foreground.hatch ?? false}
        style={{
          backgroundColor: spanBarStyles.foreground.color,
          width: spanBarStyles.foreground.width,
          display: 'block',
        }}
      />
    ) : null;
    return (
      <RowCellContainer>
        <RowCell
          data-type="span-row-cell"
          style={{
            width: `calc(${toPercent(dividerPosition)} - 0.5px)`,
          }}
        >
          {this.renderTitle()}
        </RowCell>
        {this.renderDivider(dividerHandlerChildrenProps)}
        <RowCell
          data-type="span-row-cell"
          showStriping={spanNumber % 2 !== 0}
          style={{
            width: `calc(${toPercent(1 - dividerPosition)} - 0.5px)`,
          }}
        >
          <ComparisonSpanBarRectangle
            spanBarHatch={spanBarStyles.background.hatch ?? false}
            style={{
              backgroundColor: spanBarStyles.background.color,
              width: spanBarStyles.background.width,
              display: 'block',
            }}
          />
          {foregroundSpanBar}
          {this.renderComparisonReportLabel()}
        </RowCell>
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
      </RowCellContainer>
    );
  }
  render() {
    return (
      <Row visible data-test-id="span-row">
        <DividerHandlerManager.Consumer>
          {(
            dividerHandlerChildrenProps: DividerHandlerManager.DividerHandlerManagerChildrenProps
          ) => this.renderHeader(dividerHandlerChildrenProps)}
        </DividerHandlerManager.Consumer>
      </Row>
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
  top: 4px;
  left: 1px;

  height: 16px;

  ${getHatchPattern};
`;

const ComparisonReportLabelContainer = styled('div')`
  position: absolute;
  user-select: none;
  right: ${space(1)};

  line-height: 16px;
  top: 4px;
  height: 16px;

  font-size: ${p => p.theme.fontSizeExtraSmall};
`;

export default SpanBar;
