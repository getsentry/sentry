import styled from '@emotion/styled';

import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Panel from 'sentry/components/panels/panel';
import {Tooltip} from 'sentry/components/tooltip';
import {IconFire} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Measurement} from 'sentry/types/event';
import getDuration from 'sentry/utils/duration/getDuration';
import type {Vital} from 'sentry/utils/performance/vitals/types';
import type {IconSize} from 'sentry/utils/theme';
import useProjects from 'sentry/utils/useProjects';

import {TraceDrawerComponents} from '../../traceDrawer/details/styles';
import {isTransactionNode} from '../../traceGuards';
import type {TraceTree} from '../../traceModels/traceTree';
import {TRACE_MEASUREMENT_LOOKUP} from '../../traceModels/traceTree.measurements';

interface TraceVitalsProps {
  trace: TraceTree;
}

export function TraceVitals(props: TraceVitalsProps) {
  const {projects} = useProjects();
  const measurements = Array.from(props.trace.vitals.entries());

  return (
    <TraceDrawerComponents.BodyContainer>
      {measurements.map(([node, vital]) => {
        const op = isTransactionNode(node) ? node.value['transaction.op'] : '';
        const transaction = isTransactionNode(node) ? node.value.transaction : '';
        const project = projects.find(p => p.slug === node.metadata.project_slug);

        return (
          <div key="">
            <TraceDrawerComponents.LegacyHeaderContainer>
              <TraceDrawerComponents.Title>
                <Tooltip title={node.metadata.project_slug}>
                  <ProjectBadge
                    project={project ? project : {slug: node.metadata.project_slug ?? ''}}
                    avatarSize={30}
                    hideName
                  />
                </Tooltip>
                <div>
                  <div>{t('transaction')}</div>
                  <TraceDrawerComponents.TitleOp
                    text={
                      transaction && op
                        ? `${op} - ${transaction}`
                        : transaction
                          ? transaction
                          : op
                    }
                  />
                </div>
              </TraceDrawerComponents.Title>
            </TraceDrawerComponents.LegacyHeaderContainer>

            <VitalsContainer>
              {vital.map((v, i) => {
                return <EventVital key={i} vital={v} value={v.measurement} />;
              })}
            </VitalsContainer>
          </div>
        );
      })}
    </TraceDrawerComponents.BodyContainer>
  );
}

const VitalsContainer = styled('div')`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: ${space(1)};
  margin-top: ${space(2)};
`;

interface EventVitalProps {
  value: Measurement;
  vital: TraceTree.CollectedVital;
}

function formatVitalDuration(vital: Vital, value: number) {
  if (vital?.type === 'duration') {
    return getDuration(value / 1000, 2, true);
  }

  if (vital?.type === 'integer') {
    return value.toFixed(0);
  }

  return value.toFixed(2);
}

function EventVital(props: EventVitalProps) {
  const vital = TRACE_MEASUREMENT_LOOKUP[props.vital.key];

  if (!vital) {
    return null;
  }

  const failedThreshold =
    vital.poorThreshold !== undefined && props.value.value >= vital.poorThreshold;

  const currentValue = formatVitalDuration(vital, props.value.value);
  const thresholdValue = formatVitalDuration(vital, vital?.poorThreshold ?? 0);

  return (
    <StyledPanel failedThreshold={failedThreshold}>
      <div>{vital.name ?? name}</div>
      <ValueRow>
        {failedThreshold ? (
          <FireIconContainer data-test-id="threshold-failed-warning" size="sm">
            <Tooltip
              title={t('Fails threshold at %s.', thresholdValue)}
              position="top"
              containerDisplayMode="inline-block"
            >
              <IconFire size="sm" />
            </Tooltip>
          </FireIconContainer>
        ) : null}
        <Value failedThreshold={failedThreshold}>{currentValue}</Value>
      </ValueRow>
    </StyledPanel>
  );
}

const StyledPanel = styled(Panel)<{failedThreshold: boolean}>`
  padding: ${space(1)} ${space(1.5)};
  margin-bottom: ${space(1)};
  ${p => p.failedThreshold && `border: 1px solid ${p.theme.red300};`}
`;

const ValueRow = styled('div')`
  display: flex;
  align-items: center;
`;

const FireIconContainer = styled('span')<{size: IconSize | string}>`
  display: inline-block;
  height: ${p => p.theme.iconSizes[p.size] ?? p.size};
  line-height: ${p => p.theme.iconSizes[p.size] ?? p.size};
  margin-right: ${space(0.5)};
  color: ${p => p.theme.errorText};
`;

const Value = styled('span')<{failedThreshold: boolean}>`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  ${p => p.failedThreshold && `color: ${p.theme.errorText};`}
`;
