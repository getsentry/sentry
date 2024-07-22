import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {CompactSelect} from 'sentry/components/compactSelect';
import {QueryFieldGroup} from 'sentry/components/metrics/queryFieldGroup';
import {Tooltip} from 'sentry/components/tooltip';
import {IconAdd, IconInfo, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {MetricsExtractionCondition, MRI} from 'sentry/types/metrics';
import {hasMetricsNewInputs} from 'sentry/utils/metrics/features';
import {useVirtualMetricsContext} from 'sentry/utils/metrics/virtualMetricsContext';
import useOrganization from 'sentry/utils/useOrganization';
import {useSelectedProjects} from 'sentry/views/metrics/utils/useSelectedProjects';
import {openExtractionRuleEditModal} from 'sentry/views/settings/projectMetrics/metricsExtractionRuleEditModal';

interface Props {
  isCardinalityLimited: boolean;
  mri: MRI;
  onChange: (conditionId: number) => void;
  spanConditions: MetricsExtractionCondition[];
  conditionId?: number;
}

export function MetricQuerySelect({
  onChange,
  conditionId,
  mri,
  isCardinalityLimited,
  spanConditions,
}: Props) {
  const organization = useOrganization();

  if (hasMetricsNewInputs(organization)) {
    return (
      <QueryFieldGroup.CompactSelect
        size="md"
        options={spanConditions.map(condition => ({
          label: condition.value ? (
            <Tooltip showOnlyOnOverflow title={condition.value} skipWrapper>
              <QueryLabel>{condition.value}</QueryLabel>
            </Tooltip>
          ) : (
            t('All spans')
          ),
          trailingItems: [
            isCardinalityLimited ? (
              <CardinalityWarningIcon key="cardinality-warning" />
            ) : undefined,
          ],
          textValue: condition.value || t('All spans'),
          value: condition.id,
        }))}
        value={conditionId}
        onChange={({value}) => {
          onChange(value);
        }}
        menuFooter={({closeOverlay}) => (
          <QueryFooter mri={mri} closeOverlay={closeOverlay} />
        )}
      />
    );
  }

  return (
    <CompactSelect
      size="md"
      triggerProps={{
        prefix: t('Query'),
        icon: isCardinalityLimited ? <CardinalityWarningIcon /> : null,
      }}
      options={spanConditions.map(condition => ({
        label: condition.value ? (
          <Tooltip showOnlyOnOverflow title={condition.value} skipWrapper>
            <QueryLabel>{condition.value}</QueryLabel>
          </Tooltip>
        ) : (
          t('All spans')
        ),
        trailingItems: [
          isCardinalityLimited ? (
            <CardinalityWarningIcon key="cardinality-warning" />
          ) : undefined,
        ],
        textValue: condition.value || t('All spans'),
        value: condition.id,
      }))}
      value={conditionId}
      onChange={({value}) => {
        onChange(value);
      }}
      menuFooter={({closeOverlay}) => (
        <QueryFooter mri={mri} closeOverlay={closeOverlay} />
      )}
    />
  );
}

export function CardinalityWarningIcon() {
  return (
    <Tooltip
      isHoverable
      title={t(
        "This query is exeeding the cardinality limit. Remove tags or add more filters in the metric's settings to receive accurate data."
      )}
      skipWrapper
    >
      <IconWarning
        size="xs"
        color="yellow300"
        role="image"
        aria-label={t('Exceeding the cardinality limit warning')}
      />
    </Tooltip>
  );
}

function QueryFooter({mri, closeOverlay}: {closeOverlay: () => void; mri: MRI}) {
  const {getVirtualMeta, getExtractionRule} = useVirtualMetricsContext();
  const selectedProjects = useSelectedProjects();

  const metricMeta = getVirtualMeta(mri);
  const project = selectedProjects.find(p => p.id === String(metricMeta.projectIds[0]));

  if (!project) {
    return null;
  }
  return (
    <QueryFooterWrapper>
      <Button
        size="xs"
        icon={<IconAdd isCircled />}
        onClick={() => {
          closeOverlay();
          const extractionRule = getExtractionRule(mri);
          if (!extractionRule) {
            return;
          }
          openExtractionRuleEditModal({metricExtractionRule: extractionRule});
        }}
      >
        {t('Add Query')}
      </Button>
      <InfoWrapper>
        <Tooltip
          title={t(
            'Ideally, you can visualize span data by any property you want. However, our infrastructure has limits as well, so pretty please define in advance what you want to see.'
          )}
          skipWrapper
        >
          <IconInfo size="xs" />
        </Tooltip>
        {t('What are queries?')}
      </InfoWrapper>
    </QueryFooterWrapper>
  );
}

const InfoWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  font-size: ${p => p.theme.fontSizeExtraSmall};
  color: ${p => p.theme.subText};
`;

const QueryFooterWrapper = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-width: 250px;
`;

const QueryLabel = styled('code')`
  padding-left: 0;
  max-width: 350px;
  ${p => p.theme.overflowEllipsis}
`;
