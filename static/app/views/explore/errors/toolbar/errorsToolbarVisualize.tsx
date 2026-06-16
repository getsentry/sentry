import {Tooltip} from '@sentry/scraps/tooltip';

import {t} from 'sentry/locale';
import {
  ToolbarFooter,
  ToolbarHeader,
  ToolbarLabel,
  ToolbarSection,
} from 'sentry/views/explore/components/toolbar/styles';
import {
  ToolbarVisualizeAddChart,
  ToolbarVisualizeAddEquation,
} from 'sentry/views/explore/components/toolbar/toolbarVisualize';
import {ErrorsToolbarVisualizeItem as ToolbarVisualizeItem} from 'sentry/views/explore/errors/toolbar/errorsToolbarVisualizeItem';

export function ErrorsToolbarVisualize() {
  return (
    <ToolbarSection data-test-id="section-visualizes">
      <ToolbarVisualizeHeader />
      <ToolbarVisualizeItem />
      <ToolbarFooter>
        <ToolbarVisualizeAddChart add={() => {}} disabled={false} />
        <ToolbarVisualizeAddEquation add={() => {}} disabled={false} />
      </ToolbarFooter>
    </ToolbarSection>
  );
}

function ToolbarVisualizeHeader() {
  return (
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
  );
}
