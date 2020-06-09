import React from 'react';
import styled from '@emotion/styled';
import {css} from '@emotion/core';

import {t} from 'app/locale';
import space from 'app/styles/space';
import TextOverflow from 'app/components/textOverflow';
import {IconDelete, IconEdit} from 'app/icons';
import Button from 'app/components/button';
import {Theme} from 'app/utils/theme';

import DataPrivacyRulesForm from './dataPrivacyRulesForm/dataPrivacyRulesForm';
import {getRuleTypeLabel, getMethodTypeLabel} from './dataPrivacyRulesForm/utils';
import {RuleType} from './types';

const DEFAULT_COLUMN_QUANTITY = 4;

type Rule = React.ComponentProps<typeof DataPrivacyRulesForm>['rule'];

type GridProps = {
  columnQuantity: number;
  isDisabled?: boolean;
  hoveredClassname?: string;
};

type Props = {
  rules: Array<Rule>;
  onShowEditRuleModal?: (id: Rule['id']) => () => void;
  onDeleteRule?: (id: Rule['id']) => () => void;
  disabled?: boolean;
  forwardRef?: React.Ref<HTMLDivElement>;
};

type State = {
  columnQuantity: number;
  hoveredClassname?: string;
};

class RulesList extends React.PureComponent<Props, State> {
  state: State = {columnQuantity: DEFAULT_COLUMN_QUANTITY};

  componentDidMount() {
    this.calculateColumnQuantity();
  }

  calculateColumnQuantity = () => {
    let extraColumnQuantity = 0;

    if (this.props.onDeleteRule) {
      extraColumnQuantity += 1;
    }
    if (this.props.onShowEditRuleModal) {
      extraColumnQuantity += 1;
    }

    this.setState(prevState => ({
      columnQuantity: prevState.columnQuantity + extraColumnQuantity,
    }));
  };

  handleMouseEnter = (className: string) => () => {
    this.setState({
      hoveredClassname: className,
    });
  };

  handleMouseLeave = () => {
    this.setState({
      hoveredClassname: undefined,
    });
  };

  render() {
    const {forwardRef, disabled, onDeleteRule, onShowEditRuleModal, rules} = this.props;
    const {hoveredClassname, columnQuantity} = this.state;

    return (
      <Grid
        ref={forwardRef}
        isDisabled={disabled}
        hoveredClassname={hoveredClassname}
        columnQuantity={columnQuantity}
      >
        {rules.map(({id, method, type, source, customRegularExpression}) => {
          const className = `gridCell-${id}`;
          const methodLabel = getMethodTypeLabel(method);
          const typeLabel = getRuleTypeLabel(type);
          const methodDescription =
            type === RuleType.PATTERN ? customRegularExpression : typeLabel;

          const gridCellProps = !disabled
            ? {
                onMouseEnter: this.handleMouseEnter(className),
                onMouseLeave: this.handleMouseLeave,
                className,
              }
            : {};

          return (
            <React.Fragment key={id}>
              <GridCell {...gridCellProps}>
                <InnerCell>
                  <TextOverflow>{`[${methodLabel.label}]`}</TextOverflow>
                </InnerCell>
              </GridCell>
              <GridCell {...gridCellProps}>
                <InnerCell>
                  <TextOverflow>{`[${methodDescription}]`}</TextOverflow>
                </InnerCell>
              </GridCell>
              <GridCell {...gridCellProps}>{t('from')}</GridCell>
              <GridCell {...gridCellProps}>
                <InnerCell>
                  <TextOverflow>{`[${source}]`}</TextOverflow>
                </InnerCell>
              </GridCell>
              {onShowEditRuleModal && (
                <StyledGridCell {...gridCellProps}>
                  <Button
                    label={t('Edit Rule')}
                    size="small"
                    onClick={onShowEditRuleModal(id)}
                    icon={<IconEdit />}
                    disabled={disabled}
                  />
                </StyledGridCell>
              )}
              {onDeleteRule && (
                <StyledGridCell {...gridCellProps}>
                  <Button
                    label={t('Delete Rule')}
                    size="small"
                    onClick={onDeleteRule(id)}
                    icon={<IconDelete />}
                    disabled={disabled}
                  />
                </StyledGridCell>
              )}
            </React.Fragment>
          );
        })}
      </Grid>
    );
  }
}

export default RulesList;

const columnStyle = (p: GridProps & {theme: Theme}) => {
  if (p.columnQuantity === DEFAULT_COLUMN_QUANTITY + 1) {
    return css`
      grid-template-columns: max-content auto max-content auto minmax(max-content, 1fr);
    `;
  }
  if (p.columnQuantity === DEFAULT_COLUMN_QUANTITY + 2) {
    return css`
      grid-template-columns:
        max-content auto max-content auto minmax(max-content, 1fr)
        max-content;
    `;
  }
  return css`
    grid-template-columns: auto minmax(50px, auto) max-content minmax(100px, 1fr);
  `;
};

const Grid = styled('div')<GridProps>`
  display: grid;
  align-items: center;
  > *:nth-last-child(-n + ${p => p.columnQuantity}) {
    border-bottom: 0;
  }
  > *:nth-child(${p => p.columnQuantity}n) {
    padding-right: ${space(2)};
  }
  > *:nth-child(${p => p.columnQuantity}n-${p => p.columnQuantity - 1}) {
    padding-left: ${space(2)};
  }
  ${p =>
    p.isDisabled &&
    `
      color: ${p.theme.gray400};
      background: ${p.theme.gray100};
  `}
  ${p =>
    p.hoveredClassname &&
    `
    .${p.hoveredClassname} {
      background-color: ${p.theme.gray100};
    }
  `}
  ${columnStyle}
`;

const GridCell = styled('div')`
  height: 100%;
  display: flex;
  align-items: center;
  padding: ${space(1)} ${space(0.5)};
  border-bottom: 1px solid ${p => p.theme.borderDark};
  &:last-child {
    border-bottom: 0;
  }
`;

const StyledGridCell = styled(GridCell)`
  justify-content: flex-end;
`;

const InnerCell = styled('div')`
  overflow: hidden;
  display: inline-grid;
  align-items: center;
`;
