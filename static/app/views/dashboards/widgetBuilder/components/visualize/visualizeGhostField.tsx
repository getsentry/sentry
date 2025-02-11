import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {IconDelete, IconGrabbable} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {SelectValue} from 'sentry/types/core';
import {
  generateFieldAsString,
  parseFunction,
  type QueryFieldValue,
} from 'sentry/utils/discover/fields';
import {AggregateParameterField} from 'sentry/views/dashboards/widgetBuilder/components/visualize/aggregateParameterField';
import {
  AggregateCompactSelect,
  ColumnCompactSelect,
  FieldBar,
  FieldExtras,
  FieldRow,
  LegendAliasInput,
  ParameterRefinements,
  PrimarySelectRow,
  StyledArithmeticInput,
  StyledDeleteButton,
} from 'sentry/views/dashboards/widgetBuilder/components/visualize/index';
import {type FieldValue, FieldValueKind} from 'sentry/views/discover/table/types';

type VisualizeGhostFieldProps = {
  activeId: number;
  aggregates: Array<SelectValue<FieldValue>>;
  fields: QueryFieldValue[];
  isBigNumberWidget: boolean;
  isChartWidget: boolean;
  stringFields: string[];
};

function VisualizeGhostField({
  isChartWidget,
  isBigNumberWidget,
  fields,
  activeId,
  aggregates,
  stringFields,
}: VisualizeGhostFieldProps) {
  const draggingField = useMemo(() => {
    return fields?.[Number(activeId)];
  }, [activeId, fields]);

  const draggableMatchingAggregate = useMemo(() => {
    let matchingAggregate: any;
    if (
      draggingField!.kind === FieldValueKind.FUNCTION &&
      FieldValueKind.FUNCTION in draggingField!
    ) {
      matchingAggregate = aggregates.find(
        option =>
          option.value.meta.name ===
          parseFunction(stringFields?.[Number(activeId)] ?? '')?.name
      );
    }

    return matchingAggregate;
  }, [draggingField, aggregates, stringFields, activeId]);

  const draggableHasColumnParameter = useMemo(() => {
    const isApdexOrUserMisery =
      draggableMatchingAggregate?.value.meta.name === 'apdex' ||
      draggableMatchingAggregate?.value.meta.name === 'user_misery';

    return (
      (draggingField!.kind === FieldValueKind.FUNCTION &&
        !isApdexOrUserMisery &&
        draggableMatchingAggregate?.value.meta.parameters.length !== 0) ||
      draggingField!.kind === FieldValueKind.FIELD
    );
  }, [draggableMatchingAggregate, draggingField]);

  const draggableParameterRefinements = useMemo(() => {
    return draggableMatchingAggregate?.value.meta.parameters.length > 1
      ? draggableMatchingAggregate?.value.meta.parameters.slice(1)
      : [];
  }, [draggableMatchingAggregate]);

  const isDraggableApdexOrUserMisery = useMemo(() => {
    return (
      draggableMatchingAggregate?.value.meta.name === 'apdex' ||
      draggableMatchingAggregate?.value.meta.name === 'user_misery'
    );
  }, [draggableMatchingAggregate]);

  return (
    <Ghost>
      <FieldRow>
        <DragAndReorderButton
          aria-label={t('Drag to reorder')}
          icon={<IconGrabbable size="xs" />}
          size="zero"
          borderless
        />
        <FieldBar>
          {draggingField?.kind === FieldValueKind.EQUATION ? (
            <StyledArithmeticInput
              name="arithmetic"
              key="parameter:text"
              type="text"
              placeholder={t('Equation')}
              required
              value={draggingField?.field ?? ''}
              onUpdate={() => {}}
            />
          ) : (
            <Fragment>
              <PrimarySelectRow hasColumnParameter={draggableHasColumnParameter}>
                <AggregateCompactSelect
                  hasColumnParameter={draggableHasColumnParameter}
                  disabled
                  options={[
                    {
                      label:
                        parseFunction(fields?.map(generateFieldAsString)[activeId]!)
                          ?.name ?? '',
                      value:
                        parseFunction(fields?.map(generateFieldAsString)[activeId]!)
                          ?.name ?? '',
                    },
                  ]}
                  value={
                    parseFunction(fields?.map(generateFieldAsString)[activeId]!)?.name ??
                    ''
                  }
                  onChange={() => {}}
                />
                {draggableHasColumnParameter && (
                  <ColumnCompactSelect
                    position="bottom-start"
                    disabled
                    options={[
                      {
                        label:
                          draggingField?.kind === FieldValueKind.FUNCTION
                            ? parseFunction(fields?.map(generateFieldAsString)[activeId]!)
                                ?.arguments[0] ?? ''
                            : draggingField?.field,
                        value:
                          draggingField?.kind === FieldValueKind.FUNCTION
                            ? parseFunction(fields?.map(generateFieldAsString)[activeId]!)
                                ?.arguments[0] ?? ''
                            : draggingField?.field!,
                      },
                    ]}
                    value={
                      draggingField?.kind === FieldValueKind.FUNCTION
                        ? parseFunction(fields?.map(generateFieldAsString)[activeId]!)
                            ?.arguments[0] ?? ''
                        : draggingField?.field
                    }
                    onChange={() => {}}
                  />
                )}
              </PrimarySelectRow>
              {draggingField?.kind === FieldValueKind.FUNCTION &&
                draggableParameterRefinements.length > 0 && (
                  <ParameterRefinements>
                    {draggableParameterRefinements.map(
                      (parameter: any, parameterIndex: number) => {
                        const currentValue =
                          draggingField?.function[parameterIndex + 2] || '';
                        const key = `${draggingField.function!.join('_')}-${parameterIndex}`;

                        return (
                          <AggregateParameterField
                            key={key}
                            parameter={parameter}
                            fieldValue={draggingField!}
                            currentValue={currentValue}
                            onChange={() => {}}
                          />
                        );
                      }
                    )}
                  </ParameterRefinements>
                )}
              {isDraggableApdexOrUserMisery &&
                draggingField?.kind === FieldValueKind.FUNCTION && (
                  <AggregateParameterField
                    parameter={draggableMatchingAggregate?.value.meta.parameters[0]}
                    fieldValue={draggingField!}
                    currentValue={draggingField?.function[1]}
                    onChange={() => {}}
                  />
                )}
            </Fragment>
          )}
        </FieldBar>
        <FieldExtras isChartWidget={isChartWidget || isBigNumberWidget}>
          {!isChartWidget && !isBigNumberWidget && (
            <LegendAliasInput
              type="text"
              name="name"
              placeholder={t('Add Alias')}
              value={draggingField?.alias ?? ''}
              onChange={() => {}}
            />
          )}
          <StyledDeleteButton
            borderless
            icon={<IconDelete />}
            size="zero"
            disabled
            onClick={() => {}}
            aria-label={t('Remove field')}
          />
        </FieldExtras>
      </FieldRow>
    </Ghost>
  );
}

export default VisualizeGhostField;

const Ghost = styled('div')`
  position: absolute;
  background: ${p => p.theme.background};
  padding: ${space(0.5)};
  border-radius: ${p => p.theme.borderRadius};
  box-shadow: 0 0 15px rgba(0, 0, 0, 0.15);
  opacity: 0.8;
  cursor: grabbing;
  padding-right: ${space(2)};
  width: 100%;

  button {
    cursor: grabbing;
  }

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    width: 710px;
  }
`;

const DragAndReorderButton = styled(Button)`
  height: ${p => p.theme.form.md.height}px;
`;
