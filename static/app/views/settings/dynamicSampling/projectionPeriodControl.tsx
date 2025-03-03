import styled from '@emotion/styled';

import RadioGroup from 'sentry/components/forms/controls/radioGroup';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {ProjectionSamplePeriod} from 'sentry/views/settings/dynamicSampling/utils/useProjectSampleCounts';

interface Props {
  onChange: (period: ProjectionSamplePeriod) => void;
  period: ProjectionSamplePeriod;
}

export function ProjectionPeriodControl({period, onChange}: Props) {
  return (
    <Wrapper>
      <Tooltip
        showUnderline
        title={t('The time period for which the estimated sample rates are calculated.')}
      >
        {t('Project the next')}
      </Tooltip>
      <StyledRadioGroup
        orientInline
        label={t('Project the next')}
        value={period}
        onChange={onChange}
        choices={[
          ['24h', t('24h')],
          ['30d', t('30d')],
        ]}
      />
    </Wrapper>
  );
}

const Wrapper = styled('label')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  margin-bottom: 0;
`;

const StyledRadioGroup = styled(RadioGroup<ProjectionSamplePeriod>)`
  gap: ${space(1)};
`;
