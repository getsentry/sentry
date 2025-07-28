import {useCallback} from 'react';

import {EQUATION_PREFIX} from 'sentry/utils/discover/fields';
import {
  ToolbarFooter,
  ToolbarSection,
} from 'sentry/views/explore/components/toolbar/styles';
import {
  ToolbarVisualizeAddChart,
  ToolbarVisualizeAddEquation,
  ToolbarVisualizeHeader,
} from 'sentry/views/explore/components/toolbar/toolbarVisualize';
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
  allowEquations: boolean;
  setVisualizes: (visualizes: BaseVisualize[]) => void;
  visualizes: Visualize[];
}

export function ToolbarVisualize({
  allowEquations,
  setVisualizes,
  visualizes,
}: ToolbarVisualizeProps) {
  const addChart = useCallback(() => {
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
    (group: number, newVisualize: Visualize) => {
      const newVisualizes = visualizes.map((visualize, i) => {
        if (i === group) {
          return newVisualize.toJSON();
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
      <ToolbarVisualizeHeader />
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
            onReplace={newYAxis =>
              replaceOverlay(group, visualize.replace({yAxis: newYAxis}))
            }
            yAxis={visualize.yAxis}
            traceItemType={TraceItemDataset.SPANS}
          />
        );
      })}
      <ToolbarFooter>
        <ToolbarVisualizeAddChart
          add={addChart}
          disabled={visualizes.length >= MAX_VISUALIZES}
        />
        {allowEquations && (
          <ToolbarVisualizeAddEquation
            add={addEquation}
            disabled={visualizes.length >= MAX_VISUALIZES}
          />
        )}
      </ToolbarFooter>
    </ToolbarSection>
  );
}
