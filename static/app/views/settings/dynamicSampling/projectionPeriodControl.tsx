import styled from '@emotion/styled';

import {InfoText} from '@sentry/scraps/info';
import {Flex} from '@sentry/scraps/layout';

import {RadioGroup} from 'sentry/components/forms/controls/radioGroup';
import {t} from 'sentry/locale';
import type {ProjectionSamplePeriod} from 'sentry/views/settings/dynamicSampling/utils/useProjectSampleCounts';

interface Props {
  onChange: (period: ProjectionSamplePeriod) => void;
  period: ProjectionSamplePeriod;
}

export function ProjectionPeriodControl({period, onChange}: Props) {
  return (
    <Flex as="label" align="center" gap="md" marginBottom="0">
      <InfoText
        variant="inherit"
        title={t('The time period for which the estimated sample rates are calculated.')}
      >
        {t('Project the next')}
      </InfoText>
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
    </Flex>
  );
}

const StyledRadioGroup = styled(RadioGroup<ProjectionSamplePeriod>)`
  gap: ${p => p.theme.space.md};
`;
