import {useCallback} from 'react';

import {Tooltip} from 'sentry/components/core/tooltip';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {EQUATION_PREFIX} from 'sentry/utils/discover/fields';
import {
  ToolbarFooter,
  ToolbarFooterButton,
  ToolbarHeader,
  ToolbarLabel,
  ToolbarSection,
} from 'sentry/views/explore/components/toolbar/styles';
import {VisualizeDropdown} from 'sentry/views/explore/components/toolbar/toolbarVisualize/visualizeDropdown';
import {VisualizeEquation} from 'sentry/views/explore/components/toolbar/toolbarVisualize/visualizeEquation';
import type {BaseVisualize} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {
  DEFAULT_VISUALIZATION,
  MAX_VISUALIZES,
  Visualize,
} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {TraceItemDataset} from 'sentry/views/explore/types';

interface ToolbarVisualizeProps {
  setVisualizes: (visualizes: BaseVisualize[]) => void;
  traceItemType: TraceItemDataset;
  visualizes: Visualize[];
  allowEquations?: boolean;
}

export function ToolbarVisualize({
  setVisualizes,
  traceItemType,
  visualizes,
  allowEquations = false,
}: ToolbarVisualizeProps) {
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

  const replaceOverlay = useCallback(
    (group: number, newVisualize: BaseVisualize) => {
      const newVisualizes = visualizes.map((visualize, i) => {
        if (i === group) {
          return newVisualize;
        }
        return visualize.toJSON();
      });
      setVisualizes(newVisualizes);
    },
    [setVisualizes, visualizes]
  );

  const onDelete = useCallback(
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
              onDelete={() => onDelete(group)}
              onReplace={newVisualize => replaceOverlay(group, newVisualize)}
              visualize={visualize}
            />
          );
        }
        return (
          <VisualizeDropdown
            key={group}
            canDelete={canDelete}
            onDelete={() => onDelete(group)}
            onReplace={newVisualize => replaceOverlay(group, newVisualize)}
            visualize={visualize}
            traceItemType={traceItemType}
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
