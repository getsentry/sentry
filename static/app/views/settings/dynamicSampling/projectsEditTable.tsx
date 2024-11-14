import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import partition from 'lodash/partition';

import {Button} from 'sentry/components/button';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {formatNumberWithDynamicDecimalPoints} from 'sentry/utils/number/formatNumberWithDynamicDecimalPoints';
import useProjects from 'sentry/utils/useProjects';
import {PercentInput} from 'sentry/views/settings/dynamicSampling/percentInput';
import {ProjectsTable} from 'sentry/views/settings/dynamicSampling/projectsTable';
import {SamplingBreakdown} from 'sentry/views/settings/dynamicSampling/samplingBreakdown';
import {useHasDynamicSamplingWriteAccess} from 'sentry/views/settings/dynamicSampling/utils/access';
import {projectSamplingForm} from 'sentry/views/settings/dynamicSampling/utils/projectSamplingForm';
import {scaleSampleRates} from 'sentry/views/settings/dynamicSampling/utils/scaleSampleRates';
import type {ProjectSampleCount} from 'sentry/views/settings/dynamicSampling/utils/useProjectSampleCounts';

interface Props {
  editMode: 'single' | 'bulk';
  isLoading: boolean;
  onEditModeChange: (mode: 'single' | 'bulk') => void;
  sampleCounts: ProjectSampleCount[];
}

const {useFormField} = projectSamplingForm;
const EMPTY_ARRAY = [];

export function ProjectsEditTable({
  isLoading: isLoadingProp,
  sampleCounts,
  editMode,
  onEditModeChange,
}: Props) {
  const {projects, fetching} = useProjects();
  const hasAccess = useHasDynamicSamplingWriteAccess();
  const {value, initialValue, error, onChange} = useFormField('projectRates');
  const [isBulkEditEnabled, setIsBulkEditEnabled] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [orgRate, setOrgRate] = useState<string>('');

  const projectRateSnapshotRef = useRef<Record<string, string>>({});

  const dataByProjectId = useMemo(
    () =>
      sampleCounts.reduce(
        (acc, item) => {
          acc[item.project.id] = item;
          return acc;
        },
        {} as Record<string, (typeof sampleCounts)[0]>
      ),
    [sampleCounts]
  );

  useEffect(() => {
    if (isBulkEditEnabled) {
      inputRef.current?.focus();
    }
  }, [isBulkEditEnabled]);

  const handleProjectChange = useCallback(
    (projectId: string, newRate: string) => {
      onChange(prev => ({
        ...prev,
        [projectId]: newRate,
      }));
      onEditModeChange('single');
    },
    [onChange, onEditModeChange]
  );

  const handleOrgChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const newRate = event.target.value;
      if (editMode === 'single') {
        projectRateSnapshotRef.current = value;
      }
      const cappedOrgRate = Math.min(100, Math.max(0, Number(newRate))) ?? 100;

      const scalingItems = Object.entries(projectRateSnapshotRef.current)
        .map(([projectId, rate]) => ({
          id: projectId,
          sampleRate: rate ? Number(rate) / 100 : 0,
          count: dataByProjectId[projectId]?.count ?? 0,
        }))
        // We do not wan't to bulk edit inactive projects as they have no effect on the outcome
        .filter(item => item.count !== 0);

      const {scaledItems} = scaleSampleRates({
        items: scalingItems,
        sampleRate: cappedOrgRate / 100,
      });

      const newProjectValues = scaledItems.reduce((acc, item) => {
        acc[item.id] = formatNumberWithDynamicDecimalPoints(item.sampleRate * 100, 2);
        return acc;
      }, {});
      onChange(prev => {
        return {...prev, ...newProjectValues};
      });

      setOrgRate(newRate);
      onEditModeChange('bulk');
    },
    [dataByProjectId, editMode, onChange, onEditModeChange, value]
  );

  const items = useMemo(
    () =>
      projects.map(project => {
        const item = dataByProjectId[project.id] as
          | (typeof dataByProjectId)[string]
          | undefined;
        return {
          id: project.slug,
          name: project.slug,
          count: item?.count || 0,
          ownCount: item?.ownCount || 0,
          subProjects: item?.subProjects ?? EMPTY_ARRAY,
          project: project,
          initialSampleRate: initialValue[project.id],
          sampleRate: value[project.id],
          error: error?.[project.id],
        };
      }),
    [dataByProjectId, error, initialValue, projects, value]
  );
  const [activeItems, inactiveItems] = partition(items, item => item.count > 0);

  const totalSpanCount = useMemo(
    () => items.reduce((acc, item) => acc + item.count, 0),
    [items]
  );

  const projectedOrgRate = useMemo(() => {
    if (editMode === 'bulk') {
      return orgRate;
    }
    const totalSampledSpans = items.reduce(
      (acc, item) => acc + item.count * Number(value[item.project.id] ?? 100),
      0
    );
    return formatNumberWithDynamicDecimalPoints(totalSampledSpans / totalSpanCount, 2);
  }, [editMode, items, orgRate, totalSpanCount, value]);

  const initialOrgRate = useMemo(() => {
    const totalSampledSpans = items.reduce(
      (acc, item) => acc + item.count * Number(initialValue[item.project.id] ?? 100),
      0
    );
    return formatNumberWithDynamicDecimalPoints(totalSampledSpans / totalSpanCount, 2);
  }, [initialValue, items, totalSpanCount]);

  const breakdownSampleRates = useMemo(
    () =>
      Object.entries(value).reduce(
        (acc, [projectId, rate]) => {
          acc[projectId] = Number(rate) / 100;
          return acc;
        },
        {} as Record<string, number>
      ),
    [value]
  );

  const isLoading = fetching || isLoadingProp;

  return (
    <Fragment>
      <BreakdownPanel>
        {isLoading ? (
          <LoadingIndicator
            css={css`
              margin: ${space(4)} 0;
            `}
          />
        ) : (
          <Fragment>
            <BreakdownWrapper>
              <SamplingBreakdown
                sampleCounts={sampleCounts}
                sampleRates={breakdownSampleRates}
              />
            </BreakdownWrapper>
            <FieldGroup
              label={t('Estimated Organization Rate')}
              help={t('An estimate of the combined sample rate for all projects.')}
              flexibleControlStateSize
              alignRight
            >
              <InputWrapper>
                <PercentInput
                  type="number"
                  ref={inputRef}
                  disabled={!hasAccess || !isBulkEditEnabled}
                  size="sm"
                  onChange={handleOrgChange}
                  value={projectedOrgRate}
                  onKeyDown={event => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      inputRef.current?.blur();
                    }
                  }}
                  onBlur={() => setIsBulkEditEnabled(false)}
                />
                <FlexRow>
                  <PreviousValue>
                    {initialOrgRate !== projectedOrgRate
                      ? t('previous: %f%%', initialOrgRate)
                      : // Placeholder char to prevent the line from collapsing
                        '\u200b'}
                  </PreviousValue>
                  {hasAccess && !isBulkEditEnabled && (
                    <BulkEditButton
                      size="zero"
                      tooltipProps={{
                        position: 'bottom',
                      }}
                      title={t('Proportionally scale project rates')}
                      priority="link"
                      onClick={() => {
                        setIsBulkEditEnabled(true);
                      }}
                    >
                      {t('edit')}
                    </BulkEditButton>
                  )}
                </FlexRow>
              </InputWrapper>
            </FieldGroup>
          </Fragment>
        )}
      </BreakdownPanel>

      <ProjectsTable
        rateHeader={t('Target Rate')}
        canEdit={!isBulkEditEnabled}
        onChange={handleProjectChange}
        emptyMessage={t('No active projects found in the selected period.')}
        isLoading={isLoading}
        items={activeItems}
        inactiveItems={inactiveItems}
      />
    </Fragment>
  );
}

const BreakdownPanel = styled(Panel)`
  margin-bottom: ${space(3)};
`;

const BreakdownWrapper = styled('div')`
  padding: ${space(2)};
  border-bottom: 1px solid ${p => p.theme.innerBorder};
`;

const InputWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
`;

const FlexRow = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${space(1)};
`;

const PreviousValue = styled('span')`
  font-size: ${p => p.theme.fontSizeExtraSmall};
  color: ${p => p.theme.subText};
`;

const BulkEditButton = styled(Button)`
  font-size: ${p => p.theme.fontSizeExtraSmall};
  padding: 0;
  border: none;
`;
