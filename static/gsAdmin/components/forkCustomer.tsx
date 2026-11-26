import {useEffect} from 'react';
import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';

import type {Organization} from 'sentry/types/organization';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {
  getLocalityUrlOptions,
  getLocalityDataFromOrganization,
  getLocalities,
} from 'sentry/utils/cells';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useNavigate} from 'sentry/utils/useNavigate';

import type {AdminConfirmRenderProps} from 'admin/components/adminConfirmationModal';
import {adminConfirmFormOptions} from 'admin/components/adminConfirmationModal';

type Props = AdminConfirmRenderProps & {organization: Organization};

const schema = z.object({
  regionUrl: z
    .string()
    .nullable()
    .refine(value => value !== null, 'Choose a region'),
});

const defaultValues: z.input<typeof schema> = {regionUrl: null};

/**
 * Rendered as part of a openAdminConfirmModal call
 */
export function ForkCustomerAction({
  organization,
  onConfirm,
  setConfirmCallback,
  disableConfirmButton,
}: Props) {
  const navigate = useNavigate();

  const forkMutation = useMutation({
    mutationFn: (host: string | undefined) =>
      fetchMutation<{uuid: string}>({
        method: 'POST',
        url: getApiUrl('/organizations/$organizationIdOrSlug/fork/', {
          path: {organizationIdOrSlug: organization.slug},
        }),
        options: {host},
      }),
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    ...adminConfirmFormOptions(schema, disableConfirmButton),
    defaultValues,
    validators: {onDynamic: schema},
    onSubmit: async ({value, meta}) => {
      const locality = getLocalities().find(r => r.url === value.regionUrl);

      try {
        const response = await forkMutation.mutateAsync(locality?.url);
        navigate(`/_admin/relocations/${locality?.name}/${response.uuid}/`);
        onConfirm?.({regionUrl: value.regionUrl, ...meta});
      } catch (error) {
        if (error instanceof RequestError && error.responseJSON) {
          onConfirm?.({error});
        }
      }
    },
  });

  useEffect(() => {
    setConfirmCallback(params => form.handleSubmit(params));
  }, [setConfirmCallback, form]);

  const currentRegionData = getLocalityDataFromOrganization(organization);
  const localityOptions = getLocalityUrlOptions(
    currentRegionData ? [currentRegionData] : []
  );

  return (
    <form.AppForm form={form}>
      <form.AppField name="regionUrl">
        {field => (
          <field.Layout.Stack
            label="Duplicate into Region"
            hintText="Choose which region to duplicate this organization's low volume metadata into. This will kick off a SAAS->SAAS relocation job, but the source organization will not be affected."
            required
          >
            <field.Select
              options={localityOptions}
              value={field.state.value}
              onChange={field.handleChange}
            />
          </field.Layout.Stack>
        )}
      </form.AppField>
    </form.AppForm>
  );
}
