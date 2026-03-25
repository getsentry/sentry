import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Tooltip} from '@sentry/scraps/tooltip';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {LoadingError} from 'sentry/components/loadingError';
import {t} from 'sentry/locale';
import {OnRouteLeave} from 'sentry/utils/reactRouter6Compat/onRouteLeave';
import {useOrganization} from 'sentry/utils/useOrganization';
import {ProjectionPeriodControl} from 'sentry/views/settings/dynamicSampling/projectionPeriodControl';
import {ProjectsPreviewTable} from 'sentry/views/settings/dynamicSampling/projectsPreviewTable';
import {SamplingModeSwitch} from 'sentry/views/settings/dynamicSampling/samplingModeSwitch';
import {useHasDynamicSamplingWriteAccess} from 'sentry/views/settings/dynamicSampling/utils/access';
import {parsePercent} from 'sentry/views/settings/dynamicSampling/utils/parsePercent';
import {
  useProjectSampleCounts,
  type ProjectionSamplePeriod,
} from 'sentry/views/settings/dynamicSampling/utils/useProjectSampleCounts';
import {useUpdateOrganization} from 'sentry/views/settings/dynamicSampling/utils/useUpdateOrganization';

const UNSAVED_CHANGES_MESSAGE = t(
  'You have unsaved changes, are you sure you want to leave?'
);

export const targetSampleRateSchema = z.object({
  targetSampleRate: z
    .string()
    .min(1, t('Please enter a valid number'))
    .refine(val => !isNaN(Number(val)), {message: t('Please enter a valid number')})
    .refine(
      val => {
        const n = Number(val);
        return n >= 0 && n <= 100;
      },
      {message: t('Must be between 0% and 100%')}
    ),
});

export function OrganizationSampling() {
  const organization = useOrganization();
  const hasAccess = useHasDynamicSamplingWriteAccess();
  const [period, setPeriod] = useState<ProjectionSamplePeriod>('24h');

  const initialTargetSampleRate = (
    (organization.targetSampleRate ?? 1) * 100
  )?.toString();
  const [savedTargetSampleRate, setSavedTargetSampleRate] = useState(
    initialTargetSampleRate
  );

  const {mutateAsync: updateOrganization, isPending} = useUpdateOrganization();

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      targetSampleRate: initialTargetSampleRate,
    },
    validators: {
      onDynamic: targetSampleRateSchema,
    },
    onSubmit: async ({value, formApi}) => {
      try {
        await updateOrganization({
          targetSampleRate: parsePercent(value.targetSampleRate),
        });
        addSuccessMessage(t('Changes applied.'));
        setSavedTargetSampleRate(value.targetSampleRate);
        formApi.reset(value);
      } catch {
        addErrorMessage(t('Unable to save changes. Please try again.'));
      }
    },
  });

  const sampleCountsQuery = useProjectSampleCounts({period});

  return (
    <form.AppForm form={form}>
      <form.Subscribe selector={s => ({isDirty: s.isDirty, canSubmit: s.canSubmit})}>
        {({isDirty, canSubmit}) => (
          <Fragment>
            <OnRouteLeave
              message={UNSAVED_CHANGES_MESSAGE}
              when={locationChange =>
                locationChange.currentLocation.pathname !==
                  locationChange.nextLocation.pathname && isDirty
              }
            />
            <HeadingRow>
              <ProjectionPeriodControl period={period} onChange={setPeriod} />
              <SamplingModeSwitch />
            </HeadingRow>
            {sampleCountsQuery.isError ? (
              <LoadingError onRetry={sampleCountsQuery.refetch} />
            ) : (
              <form.AppField name="targetSampleRate">
                {field => (
                  <ProjectsPreviewTable
                    sampleCounts={sampleCountsQuery.data}
                    isLoading={sampleCountsQuery.isPending}
                    period={period}
                    targetSampleRate={field.state.value}
                    savedTargetSampleRate={savedTargetSampleRate}
                    onTargetSampleRateChange={field.handleChange}
                    targetSampleRateError={field.state.meta.errors[0]?.message}
                    actions={
                      <Fragment>
                        <Button
                          disabled={!isDirty || isPending}
                          onClick={() => form.reset()}
                        >
                          {t('Reset')}
                        </Button>
                        <Tooltip
                          disabled={hasAccess}
                          title={t(
                            'You do not have permission to update these settings.'
                          )}
                        >
                          <form.SubmitButton
                            disabled={!hasAccess || !canSubmit || !isDirty}
                            formNoValidate
                          >
                            {t('Apply Changes')}
                          </form.SubmitButton>
                        </Tooltip>
                      </Fragment>
                    }
                  />
                )}
              </form.AppField>
            )}
            <SubTextParagraph>
              {t(
                'Inactive projects are not listed and will be sampled at 100% initially.'
              )}
            </SubTextParagraph>
          </Fragment>
        )}
      </form.Subscribe>
    </form.AppForm>
  );
}

const HeadingRow = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: ${p => p.theme.space.lg};

  & > h4 {
    margin: 0;
  }
`;

const SubTextParagraph = styled('p')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.sm};
`;
