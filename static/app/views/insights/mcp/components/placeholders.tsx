import styled from '@emotion/styled';

import Panel from 'sentry/components/panels/panel';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';

const PlaceholderContent = styled('div')`
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.md};
`;

const TableContainer = styled('div')`
  margin-top: ${space(2)};
`;

const PlaceholderTable = styled(Panel)`
  padding: ${space(2)};
  text-align: center;
  color: ${p => p.theme.subText};
`;

function PlaceholderText() {
  return <PlaceholderContent>{t('Placeholder')}</PlaceholderContent>;
}

export function McpTrafficWidget() {
  return (
    <Widget
      Title={<Widget.WidgetTitle title={t('Traffic + Error rate')} />}
      Visualization={<PlaceholderText />}
    />
  );
}

export function RequestsBySourceWidget() {
  return (
    <Widget
      Title={<Widget.WidgetTitle title={t('Requests by source')} />}
      Visualization={<PlaceholderText />}
    />
  );
}

export function TransportDistributionWidget() {
  return (
    <Widget
      Title={<Widget.WidgetTitle title={t('Transport distribution')} />}
      Visualization={<PlaceholderText />}
    />
  );
}

export function GroupedTrafficWidget({
  groupBy,
}: {
  groupBy: 'tool' | 'resource' | 'prompt';
}) {
  return (
    <Widget
      Title={<Widget.WidgetTitle title={`Traffic by ${groupBy}`} />}
      Visualization={<PlaceholderText />}
    />
  );
}

export function GroupedDurationWidget({
  groupBy,
}: {
  groupBy: 'tool' | 'resource' | 'prompt';
}) {
  return (
    <Widget
      Title={<Widget.WidgetTitle title={`Duration by ${groupBy}`} />}
      Visualization={<PlaceholderText />}
    />
  );
}

export function GroupedErrorRateWidget({
  groupBy,
}: {
  groupBy: 'tool' | 'resource' | 'prompt';
}) {
  return (
    <Widget
      Title={<Widget.WidgetTitle title={`Error rate by ${groupBy}`} />}
      Visualization={<PlaceholderText />}
    />
  );
}

// Tools table
export function ToolsTable() {
  return (
    <TableContainer>
      <PlaceholderTable>
        <h3>{t('Tools Table')}</h3>
        <p>
          {t(
            'Placeholder for tools table with metrics like requests, error rate, avg, p95'
          )}
        </p>
      </PlaceholderTable>
    </TableContainer>
  );
}

// Resources table
export function ResourcesTable() {
  return (
    <TableContainer>
      <PlaceholderTable>
        <h3>{t('Resources Table')}</h3>
        <p>{t('Placeholder for resources table')}</p>
      </PlaceholderTable>
    </TableContainer>
  );
}

// Prompts table
export function PromptsTable() {
  return (
    <TableContainer>
      <PlaceholderTable>
        <h3>{t('Prompts Table')}</h3>
        <p>{t('Placeholder for prompts table')}</p>
      </PlaceholderTable>
    </TableContainer>
  );
}
