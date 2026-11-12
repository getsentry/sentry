import {useCallback, useEffect, useState} from 'react';

import {Client} from 'sentry/api';
import {SelectField} from 'sentry/components/forms/fields/selectField';
import type {Organization} from 'sentry/types/organization';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {
  getLocalityUrlOptions,
  getLocalityDataFromOrganization,
  getLocalities,
} from 'sentry/utils/cells';
import {useNavigate} from 'sentry/utils/useNavigate';

import type {
  AdminConfirmParams,
  AdminConfirmRenderProps,
} from 'admin/components/adminConfirmationModal';

type Props = AdminConfirmRenderProps & {
  organization: Organization;
};

/**
 * Rendered as part of a openAdminConfirmModal call
 */
export function ForkCustomerAction({organization, onConfirm, setConfirmCallback}: Props) {
  const navigate = useNavigate();
  const [regionUrl, setRegionUrl] = useState('');

  const handleConfirm = useCallback(
    async (params: AdminConfirmParams) => {
      const api = new Client({headers: {Accept: 'application/json; charset=utf-8'}});
      const localities = getLocalities();
      const locality = localities.find(r => r.url === regionUrl);

      try {
        const response = await api.requestPromise(
          getApiUrl('/organizations/$organizationIdOrSlug/fork/', {
            path: {organizationIdOrSlug: organization.slug},
          }),
          {
            method: 'POST',
            host: locality?.url,
          }
        );

        navigate(`/_admin/relocations/${locality?.name}/${response.uuid}/`);
        onConfirm?.({regionUrl, ...params});
      } catch (error: any) {
        if (error.responseJSON) {
          onConfirm?.({error});
        }
      }
    },
    [organization, regionUrl, onConfirm, navigate]
  );

  // Register the confirm callback whenever it changes (regionUrl updates handleConfirm)
  useEffect(() => {
    setConfirmCallback(handleConfirm);
  }, [setConfirmCallback, handleConfirm]);

  const currentRegionData = getLocalityDataFromOrganization(organization);
  const localityOptions = getLocalityUrlOptions(
    currentRegionData ? [currentRegionData] : []
  );

  return (
    <SelectField
      name="regionUrl"
      label="Duplicate into Region"
      help="Choose which region to duplicate this organization's low volume metadata into. This will kick off a SAAS->SAAS relocation job, but the source organization will not be affected."
      options={localityOptions}
      inline={false}
      stacked
      required
      value={regionUrl}
      onChange={(val: any) => setRegionUrl(val)}
    />
  );
}
