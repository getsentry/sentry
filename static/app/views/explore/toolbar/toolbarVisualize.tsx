import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import {ArithmeticBuilder} from 'sentry/components/arithmeticBuilder';
import type {Expression} from 'sentry/components/arithmeticBuilder/expression';
import type {
  AggregateFunction,
  FunctionArgument,
} from 'sentry/components/arithmeticBuilder/types';
import {Button} from 'sentry/components/core/button';
import type {SelectKey, SelectOption} from 'sentry/components/core/compactSelect';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconAdd} from 'sentry/icons';
import {IconDelete} from 'sentry/icons/iconDelete';
import {t} from 'sentry/locale';
import {
  EQUATION_PREFIX,
  parseFunction,
  stripEquationPrefix,
} from 'sentry/utils/discover/fields';
import {ALLOWED_EXPLORE_VISUALIZE_AGGREGATES} from 'sentry/utils/fields';
import {
  useExploreVisualizes,
  useSetExploreVisualizes,
} from 'sentry/views/explore/contexts/pageParamsContext';
import type {BaseVisualize} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {
  DEFAULT_VISUALIZATION,
  MAX_VISUALIZES,
  updateVisualizeAggregate,
  Visualize,
} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {useTraceItemTags} from 'sentry/views/explore/contexts/spanTagsContext';
import {useVisualizeFields} from 'sentry/views/explore/hooks/useVisualizeFields';

import {
  ToolbarFooter,
  ToolbarFooterButton,
  ToolbarHeader,
  ToolbarLabel,
  ToolbarRow,
  ToolbarSection,
} from './styles';

interface ToolbarVisualizeProps {
  allowEquations: boolean;
}

export function ToolbarVisualize({allowEquations}: ToolbarVisualizeProps) {
  const visualizes = useExploreVisualizes();
  const setVisualizes = useSetExploreVisualizes();

  const addAggregate = useCallback(() => {
    const newVisualizes = [...visualizes, new Visualize(DEFAULT_VISUALIZATION)].map(
      visualize => visualize.toJSON()
    );
    setVisualizes(newVisualizes);
  }, [setVisualizes, visualizes]);

  const addEquation = useCallback(() => {
    const newVisualizes = [...visualizes, new Visualize(EQUATION_PREFIX)].map(visualize =>
      visualize.toJSON()
    );
    setVisualizes(newVisualizes);
  }, [setVisualizes, visualizes]);

  const deleteOverlay = useCallback(
    (group: number) => {
      const newVisualizes = visualizes
        .toSpliced(group, 1)
        .map(visualize => visualize.toJSON());
      setVisualizes(newVisualizes);
    },
    [setVisualizes, visualizes]
  );

  const canDelete = visualizes.filter(visualize => !visualize.isEquation).length > 1;

  return (
    <ToolbarSection data-test-id="section-visualizes">
      <ToolbarHeader>
        <Tooltip
          position="right"
          title={t(
            'Primary metric that appears in your chart. You can also overlay a series onto an existing chart or add an equation.'
          )}
        >
          <ToolbarLabel>{t('Visualize')}</ToolbarLabel>
        </Tooltip>
      </ToolbarHeader>
      {visualizes.map((visualize, group) => {
        if (visualize.isEquation) {
          return (
            <VisualizeEquation
              key={group}
              deleteOverlay={deleteOverlay}
              group={group}
              yAxis={visualize.yAxis}
              visualizes={visualizes}
              setVisualizes={setVisualizes}
            />
          );
        }
        return (
          <VisualizeDropdown
            key={group}
            canDelete={canDelete}
            deleteOverlay={deleteOverlay}
            group={group}
            yAxis={visualize.yAxis}
            visualizes={visualizes}
            setVisualizes={setVisualizes}
          />
        );
      })}
      <ToolbarFooter>
        <ToolbarFooterButton
          borderless
          size="zero"
          icon={<IconAdd />}
          onClick={addAggregate}
          priority="link"
          aria-label={t('Add Chart')}
          disabled={visualizes.length >= MAX_VISUALIZES}
        >
          {t('Add Chart')}
        </ToolbarFooterButton>
        {allowEquations && (
          <ToolbarFooterButton
            borderless
            size="zero"
            icon={<IconAdd />}
            onClick={addEquation}
            priority="link"
            aria-label={t('Add Equation')}
            disabled={visualizes.length >= MAX_VISUALIZES}
          >
            {t('Add Equation')}
          </ToolbarFooterButton>
        )}
      </ToolbarFooter>
    </ToolbarSection>
  );
}

interface VisualizeEquationProps {
  deleteOverlay: (group: number) => void;
  group: number;
  setVisualizes: (visualizes: BaseVisualize[]) => void;
  visualizes: Visualize[];
  yAxis: string;
}

function VisualizeEquation({
  deleteOverlay,
  group,
  setVisualizes,
  yAxis,
  visualizes,
}: VisualizeEquationProps) {
  const expression = stripEquationPrefix(yAxis);

  const {tags: numberTags} = useTraceItemTags('number');

  const aggregateFunctions: AggregateFunction[] = useMemo(() => {
    return ALLOWED_EXPLORE_VISUALIZE_AGGREGATES.map(aggregate => ({
      name: aggregate,
      label: aggregate,
    }));
  }, []);

  const functionArguments: FunctionArgument[] = useMemo(() => {
    return Object.entries(numberTags).map(([key, tag]) => {
      return {
        name: key,
        label: tag.name,
      };
    });
  }, [numberTags]);

  const handleExpressionChange = useCallback(
    (newExpression: Expression) => {
      const newVisualizes = visualizes
        .toSpliced(
          group,
          1,
          visualizes[group]!.replace({yAxis: `${EQUATION_PREFIX}${newExpression.text}`})
        )
        .map(visualize => visualize.toJSON());
      setVisualizes(newVisualizes);
    },
    [group, setVisualizes, visualizes]
  );

  return (
    <ToolbarRow>
      <ArithmeticBuilder
        aggregateFunctions={aggregateFunctions}
        functionArguments={functionArguments}
        expression={expression}
        setExpression={handleExpressionChange}
      />
      <Button
        borderless
        icon={<IconDelete />}
        size="zero"
        onClick={() => deleteOverlay(group)}
        aria-label={t('Remove Overlay')}
      />
    </ToolbarRow>
  );
}

interface VisualizeDropdownProps {
  canDelete: boolean;
  deleteOverlay: (group: number) => void;
  group: number;
  setVisualizes: (visualizes: BaseVisualize[]) => void;
  visualizes: Visualize[];
  yAxis: string;
}

function VisualizeDropdown({
  canDelete,
  deleteOverlay,
  group,
  setVisualizes,
  visualizes,
  yAxis,
}: VisualizeDropdownProps) {
  const {tags: stringTags} = useTraceItemTags('string');
  const {tags: numberTags} = useTraceItemTags('number');

  const parsedFunction = useMemo(() => parseFunction(yAxis), [yAxis]);

  const aggregateOptions: Array<SelectOption<string>> = useMemo(() => {
    return ALLOWED_EXPLORE_VISUALIZE_AGGREGATES.map(aggregate => {
      return {
        label: aggregate,
        value: aggregate,
        textValue: aggregate,
      };
    });
  }, []);

  const fieldOptions: Array<SelectOption<string>> = useVisualizeFields({
    numberTags,
    stringTags,
    parsedFunction,
  });

  const setYAxis = useCallback(
    (newYAxis: string) => {
      const newVisualizes = visualizes
        .toSpliced(group, 1, visualizes[group]!.replace({yAxis: newYAxis}))
        .map(visualize => visualize.toJSON());
      setVisualizes(newVisualizes);
    },
    [group, setVisualizes, visualizes]
  );

  const setChartAggregate = useCallback(
    (option: SelectOption<SelectKey>) => {
      const newYAxis = updateVisualizeAggregate({
        newAggregate: option.value as string,
        oldAggregate: parsedFunction?.name,
        oldArgument: parsedFunction?.arguments[0]!,
      });
      setYAxis(newYAxis);
    },
    [parsedFunction, setYAxis]
  );

  const setChartField = useCallback(
    (option: SelectOption<SelectKey>) => {
      setYAxis(`${parsedFunction?.name}(${option.value})`);
    },
    [parsedFunction?.name, setYAxis]
  );

  return (
    <ToolbarRow>
      <AggregateCompactSelect
        searchable
        options={aggregateOptions}
        value={parsedFunction?.name ?? ''}
        onChange={setChartAggregate}
      />
      <ColumnCompactSelect
        searchable
        options={fieldOptions}
        value={parsedFunction?.arguments[0] ?? ''}
        onChange={setChartField}
        disabled={fieldOptions.length === 1}
      />
      {canDelete ? (
        <Button
          borderless
          icon={<IconDelete />}
          size="zero"
          onClick={() => deleteOverlay(group)}
          aria-label={t('Remove Overlay')}
        />
      ) : null}
    </ToolbarRow>
  );
}

const ColumnCompactSelect = styled(CompactSelect)`
  flex: 1 1;
  min-width: 0;

  > button {
    width: 100%;
  }
`;

const AggregateCompactSelect = styled(CompactSelect)`
  width: 100px;

  > button {
    width: 100%;
  }
`;
