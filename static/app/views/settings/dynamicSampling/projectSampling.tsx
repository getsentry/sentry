import {useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import ExternalLink from 'sentry/components/links/externalLink';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {Tooltip} from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useProjects from 'sentry/utils/useProjects';
import {ProjectsEditTable} from 'sentry/views/settings/dynamicSampling/projectsEditTable';
import {SamplingModeField} from 'sentry/views/settings/dynamicSampling/samplingModeField';
import {projectSamplingForm} from 'sentry/views/settings/dynamicSampling/utils/projectSamplingForm';

const {useFormState, FormProvider} = projectSamplingForm;

export function ProjectSampling() {
  const {projects} = useProjects();
  const [period, setPeriod] = useState<'24h' | '30d'>('24h');

  // TODO(aknaus): Fetch initial project rates from API
  const fakeInitialProjectRates = projects.reduce(
    (acc, project) => {
      acc[project.id] = (Math.round(Math.random() * 10000) / 100).toString();
      return acc;
    },
    {} as Record<string, string>
  );

  const formState = useFormState({
    projectRates: fakeInitialProjectRates,
  });

  return (
    <FormProvider formState={formState}>
      <form onSubmit={event => event.preventDefault()}>
        <Panel>
          <PanelHeader>{t('Manual Sampling')}</PanelHeader>
          <PanelBody>
            <FieldGroup
              label={t('Sampling Mode')}
              help={t('The current configuration mode for dynamic sampling.')}
            >
              <div
                css={css`
                  display: flex;
                  align-items: center;
                  gap: ${space(1)};
                `}
              >
                {t('Manual')}{' '}
                <QuestionTooltip
                  size="sm"
                  isHoverable
                  title={tct(
                    'Manual mode allows you to set fixed sample rates for each project. [link:Learn more]',
                    {
                      link: (
                        <ExternalLink href="https://docs.sentry.io/product/performance/retention-priorities/" />
                      ),
                    }
                  )}
                />
              </div>
            </FieldGroup>
            <SamplingModeField />
          </PanelBody>
        </Panel>
        <HeadingRow>
          <h4>{t('Customize Projects')}</h4>
          <Tooltip
            title={t(
              'The time period for which the projected sample rates are calculated.'
            )}
          >
            <SegmentedControl value={period} onChange={setPeriod} size="xs">
              <SegmentedControl.Item key="24h">{t('24h')}</SegmentedControl.Item>
              <SegmentedControl.Item key="30d">{t('30d')}</SegmentedControl.Item>
            </SegmentedControl>
          </Tooltip>
        </HeadingRow>
        <p>{t('Set custom rates for traces starting at each of your projects.')}</p>
        <ProjectsEditTable period={period} />
        <FormActions>
          <Button disabled>{t('Reset')}</Button>
          <Button priority="primary" disabled>
            {t('Apply Changes')}
          </Button>
        </FormActions>
      </form>
    </FormProvider>
  );
}

const FormActions = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, max-content);
  gap: ${space(1)};
  justify-content: flex-end;
  padding-bottom: ${space(4)};
`;

const HeadingRow = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: ${space(3)};
  padding-bottom: ${space(1.5)};

  & > * {
    margin: 0;
  }
`;
