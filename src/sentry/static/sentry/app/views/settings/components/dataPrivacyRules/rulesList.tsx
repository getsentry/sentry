import React from 'react';
import styled from '@emotion/styled';
import PropTypes from 'prop-types';

import {t} from 'app/locale';
import space from 'app/styles/space';
import TextOverflow from 'app/components/textOverflow';
import {IconDelete, IconEdit} from 'app/icons';
import Button from 'app/components/button';

import DataPrivacyRulesForm from './dataPrivacyRulesForm/dataPrivacyRulesForm';
import {getRuleTypeLabel, getMethodTypeLabel} from './dataPrivacyRulesForm/utils';
import {RuleType} from './types';

type Rule = React.ComponentProps<typeof DataPrivacyRulesForm>['rule'];
type Props = {
  rules: Array<Rule>;
  onShowEditRuleModal?: (id: Rule['id']) => () => void;
  onDeleteRule?: (id: Rule['id']) => () => void;
  disabled?: boolean;
};

const RulesList = React.forwardRef<HTMLDivElement, Props>(function RulesList(
  {rules, onShowEditRuleModal, onDeleteRule, disabled},
  ref
) {
  return (
    <Grid ref={ref} isDisabled={disabled}>
      {rules.map(({id, method, type, source, customRegularExpression}) => {
        const methodLabel = getMethodTypeLabel(method);
        const typeLabel = getRuleTypeLabel(type);
        const methodDescription =
          type === RuleType.PATTERN ? customRegularExpression : typeLabel;
        return (
          <React.Fragment key={id}>
            <GridCell>
              <InnerCell>
                <TextOverflow>{`[${methodLabel.label}]`}</TextOverflow>
              </InnerCell>
            </GridCell>
            <GridCell>
              <InnerCell>
                <TextOverflow>{`[${methodDescription}]`}</TextOverflow>
              </InnerCell>
            </GridCell>
            <GridCell>{t('from')}</GridCell>
            <GridCell>
              <InnerCell>
                <TextOverflow>{`[${source}]`}</TextOverflow>
              </InnerCell>
            </GridCell>
            {onShowEditRuleModal && (
              <Action>
                <Button
                  label={t('Edit Rule')}
                  size="small"
                  onClick={onShowEditRuleModal(id)}
                  icon={<IconEdit />}
                  disabled={disabled}
                />
              </Action>
            )}
            {onDeleteRule && (
              <Action>
                <Button
                  label={t('Delete Rule')}
                  size="small"
                  onClick={onDeleteRule(id)}
                  icon={<IconDelete />}
                  disabled={disabled}
                />
              </Action>
            )}
          </React.Fragment>
        );
      })}
    </Grid>
  );
});

RulesList.propTypes = {
  rules: PropTypes.array.isRequired,
  onShowEditRuleModal: PropTypes.func,
  onDeleteRule: PropTypes.func,
  disabled: PropTypes.bool,
};

export default RulesList;

const Grid = styled('div')<{isDisabled?: boolean}>`
  display: grid;
  grid-template-columns: auto auto max-content auto 1fr max-content;
  align-items: center;
  > *:nth-last-child(-n + 6) {
    border-bottom: 0;
  }
  > *:nth-child(6n) {
    padding-right: ${space(2)};
  }
  > *:nth-child(6n-5) {
    padding-left: ${space(2)};
  }
  ${p =>
    p.isDisabled &&
    `
      color: ${p.theme.gray400};
      background: ${p.theme.gray100};
  `}
`;

const GridCell = styled('div')`
  height: 100%;
  display: flex;
  align-items: center;
  padding: ${space(1)} ${space(0.5)};
  border-bottom: 1px solid ${p => p.theme.borderDark};
  &:hover {
    background-color: ${p => p.theme.gray100};
  }
  &:last-child {
    border-bottom: 0;
  }
`;

const Action = styled(GridCell)`
  justify-content: flex-end;
`;

const InnerCell = styled('div')`
  overflow: hidden;
  display: inline-grid;
  align-items: center;
`;
