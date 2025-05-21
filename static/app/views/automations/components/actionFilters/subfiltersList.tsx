import styled from '@emotion/styled';
import {uuid4} from '@sentry/core';

import {Button} from 'sentry/components/core/button';
import AutomationBuilderInputField from 'sentry/components/workflowEngine/form/automationBuilderInputField';
import {RowLine} from 'sentry/components/workflowEngine/form/automationBuilderRowLine';
import AutomationBuilderSelectField from 'sentry/components/workflowEngine/form/automationBuilderSelectField';
import {PurpleTextButton} from 'sentry/components/workflowEngine/ui/purpleTextButton';
import {IconAdd, IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {MatchType} from 'sentry/views/automations/components/actionFilters/constants';
import {useDataConditionNodeContext} from 'sentry/views/automations/components/dataConditionNodes';

export function SubfiltersList() {
  const {condition, condition_id, onUpdate} = useDataConditionNodeContext();

  const subfilters = condition.comparison.filters || [];
  const subfilterCount = subfilters.length;

  function addSubfilter() {
    const newSubfilters = [
      ...subfilters,
      {
        id: uuid4(),
        match: MatchType.EQUAL,
      },
    ];
    onUpdate({filters: newSubfilters});
  }

  function removeSubfilter(id: string) {
    const newSubfilters = subfilters.filter(
      (subfilter: Record<string, any>) => subfilter.id !== id
    );
    onUpdate({filters: newSubfilters});
  }

  function updateSubfilter(id: string, comparison: Record<string, any>) {
    const newSubfilters = subfilters.map((subfilter: Record<string, any>) => {
      if (subfilter.id === id) {
        return {
          ...subfilter,
          ...comparison,
        };
      }
      return subfilter;
    });
    onUpdate({filters: newSubfilters});
  }

  return (
    <div>
      <div>
        {subfilters.map((subfilter: Record<string, any>, i: number) => {
          return (
            <SubfilterRow
              subfilter={subfilter}
              subfilter_id={`${condition_id}.comparison.filters.${subfilter.id}`}
              onRemove={() => removeSubfilter(subfilter.id)}
              onUpdate={comparison => updateSubfilter(subfilter.id, comparison)}
              key={subfilter.id}
              isLastRow={i === subfilterCount - 1}
            />
          );
        })}
      </div>
      <PurpleTextButton borderless icon={<IconAdd />} size="xs" onClick={addSubfilter}>
        {t('Sub-filter')}
      </PurpleTextButton>
    </div>
  );
}

interface SubfilterRowProps {
  onRemove: () => void;
  onUpdate: (comparison: Record<string, any>) => void;
  subfilter: Record<string, any>;
  subfilter_id: string;
  isLastRow?: boolean;
}

function SubfilterRow({
  subfilter,
  subfilter_id,
  onRemove,
  onUpdate,
  isLastRow,
}: SubfilterRowProps) {
  return (
    <RowWrapper>
      <Branch lastChild={isLastRow} />
      <StyledRowLine>
        <AutomationBuilderInputField
          name={`${subfilter_id}.key`}
          placeholder={t('key')}
          value={subfilter.key}
          onChange={(value: string) => {
            onUpdate({
              key: value,
            });
          }}
        />
        <AutomationBuilderSelectField
          name={`${subfilter_id}.match`}
          value={subfilter.match}
          options={[
            {
              label: 'is',
              value: MatchType.EQUAL,
            },
            {
              label: 'is not',
              value: MatchType.NOT_EQUAL,
            },
          ]}
          onChange={(value: MatchType) => {
            onUpdate({match: value});
          }}
        />
        <AutomationBuilderInputField
          name={`${subfilter_id}.value`}
          placeholder={t('value')}
          value={`${subfilter.value}`}
          onChange={(value: string) => {
            onUpdate({
              value,
            });
          }}
        />
        {!isLastRow && t('and')}
        <Button
          aria-label={t('Delete Subfilter')}
          size="sm"
          icon={<IconDelete />}
          borderless
          onClick={onRemove}
        />
      </StyledRowLine>
    </RowWrapper>
  );
}

const RowWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};

  :first-child {
    margin-top: 3px;
  }
`;

const StyledRowLine = styled(RowLine)`
  padding: 3px 0;

  Button {
    opacity: 0;
  }

  :hover {
    Button {
      opacity: 1;
    }
  }
`;

interface BranchProps {
  lastChild?: boolean;
}

function Branch({lastChild}: BranchProps) {
  return (
    <svg
      width="26"
      height="38"
      viewBox="0 0 26 38"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <line x1="0.5" x2="0.5" y2={lastChild ? '19' : '38'} stroke="#80708F" />
      <circle cx="23.5" cy="18.5" r="2.5" fill="#80708F" />
      <line x1="22" y1="18.5" x2="1" y2="18.5" stroke="#80708F" />
    </svg>
  );
}
