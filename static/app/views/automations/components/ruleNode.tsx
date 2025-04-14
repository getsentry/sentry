import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/container/flex';
import {Button} from 'sentry/components/core/button';
import NumberField from 'sentry/components/forms/fields/numberField';
import SelectField from 'sentry/components/forms/fields/selectField';
import {IconDelete} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface RuleNodeProps {
  condition: Record<string, any>;
  condition_id: string;
  onDelete: () => void;
  onUpdate: (condition: Record<string, any>) => void;
}

export default function RuleNode({
  condition,
  condition_id,
  onDelete,
  onUpdate,
}: RuleNodeProps) {
  return (
    <RuleRowContainer>
      <RuleRow>
        <Rule>
          {(() => {
            const node = ruleNodesMap[condition.type];
            const configNode = node?.config_node;
            if (configNode) {
              return configNode(condition_id, onUpdate);
            }
            return node?.label;
          })()}
        </Rule>
        <DeleteButton
          aria-label={t('Delete Node')}
          size="sm"
          icon={<IconDelete />}
          borderless
          onClick={onDelete}
        />
      </RuleRow>
    </RuleRowContainer>
  );
}

const RuleRowContainer = styled('div')<{incompatible?: boolean}>`
  background-color: ${p => p.theme.backgroundSecondary};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px ${p => p.theme.innerBorder} solid;
  border-color: ${p => (p.incompatible ? p.theme.red200 : 'none')};
`;

const RuleRow = styled(Flex)`
  align-items: center;
  padding: ${space(1)};
`;

const Rule = styled(Flex)`
  align-items: center;
  flex: 1;
  flex-wrap: wrap;
  gap: ${space(1)};
`;

const InlineNumberInput = styled(NumberField)`
  padding: 0;
  width: 90px;
  height: 28px;
  min-height: 28px;
  > div {
    padding-left: 0;
  }
`;

const selectControlStyles = {
  control: (provided: any) => ({
    ...provided,
    minHeight: '28px',
    height: '28px',
    padding: 0,
  }),
};

const InlineSelectControl = styled(SelectField)`
  width: 180px;
  padding: 0;
  > div {
    padding-left: 0;
  }
`;

const DeleteButton = styled(Button)`
  flex-shrink: 0;
  opacity: 0;

  ${RuleRowContainer}:hover & {
    opacity: 1;
  }
`;

export type RuleNodeConfig = {
  label: string;
  config_node?: (
    condition_id: string,
    onUpdate: (condition: Record<string, any>) => void
  ) => React.ReactNode;
};

export const ruleNodesMap: Record<string, RuleNodeConfig> = {
  every_event: {
    label: t('An event is captured'),
  },
  first_seen_event: {
    label: t('A new issue is created'),
  },
  regression_event: {
    label: t('A resolved issue becomes unresolved'),
  },
  reappeared_event: {
    label: t('An issue escalates'),
  },
  age_comparison: {
    label: t('Compare the age of an issue'),
    config_node: (
      condition_id: string,
      onUpdate: (condition: Record<string, any>) => void
    ) => (
      <Fragment>
        {tct('The issue is [comparison_type] [value] [time]', {
          comparison_type: (
            <InlineSelectControl
              styles={selectControlStyles}
              name={`${condition_id}.comparison.type`}
              options={[
                {value: 'older', label: 'older than'},
                {value: 'newer', label: 'newer than'},
              ]}
              onChange={(value: string) => {
                onUpdate({
                  type: value,
                });
              }}
            />
          ),
          value: (
            <InlineNumberInput
              name={`${condition_id}.comparison.value`}
              min={0}
              step={1}
              onChange={(value: string) => {
                onUpdate({
                  value: parseInt(value, 10),
                });
              }}
            />
          ),
          time: (
            <InlineSelectControl
              styles={selectControlStyles}
              name={`${condition_id}.comparison.time`}
              options={[
                {value: 'minutes', label: 'minute(s)'},
                {value: 'hours', label: 'hour(s)'},
                {value: 'days', label: 'day(s)'},
              ]}
              onChange={(value: string) => {
                onUpdate({
                  time: value,
                });
              }}
            />
          ),
        })}
      </Fragment>
    ),
  },
  issue_frequency: {
    label: t('Check how many times an issue has occurred'),
    config_node: (condition_id: string, onUpdate) => (
      <Fragment>
        {tct('The issue has happened at least [value] times', {
          value: (
            <InlineNumberInput
              name={`${condition_id}.comparison.value`}
              min={1}
              step={1}
              onChange={(value: string) => {
                onUpdate({
                  value,
                });
              }}
            />
          ),
        })}
      </Fragment>
    ),
  },
};
