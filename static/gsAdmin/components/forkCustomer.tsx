import {useEffect, useRef, useState} from 'react';

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

  // The confirm callback is registered once on mount, so it reads the latest
  // values through refs rather than closing over stale render values.
  const regionUrlRef = useRef('');
  const latestRef = useRef({organization, onConfirm, navigate});

  useEffect(() => {
    latestRef.current = {organization, onConfirm, navigate};
  }, [organization, onConfirm, navigate]);

  useEffect(() => {
    const handleConfirm = async (params: AdminConfirmParams) => {
      const api = new Client({headers: {Accept: 'application/json; charset=utf-8'}});
      const {
        organization: currentOrganization,
        onConfirm: currentOnConfirm,
        navigate: currentNavigate,
      } = latestRef.current;
      const currentRegionUrl = regionUrlRef.current;
      const localities = getLocalities();
      const locality = localities.find(r => r.url === currentRegionUrl);

      try {
        const response = await api.requestPromise(
          getApiUrl('/organizations/$organizationIdOrSlug/fork/', {
            path: {organizationIdOrSlug: currentOrganization.slug},
          }),
          {
            method: 'POST',
            host: locality?.url,
          }
        );

        currentNavigate(`/_admin/relocations/${locality?.name}/${response.uuid}/`);
        currentOnConfirm?.({regionUrl: currentRegionUrl, ...params});
      } catch (error: any) {
        if (error.responseJSON) {
          currentOnConfirm?.({error});
        }
      }
    };

    setConfirmCallback(handleConfirm);
    // Only register the callback once on mount. setConfirmCallback is recreated
    // on every parent render, so depending on it would re-register needlessly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      onChange={(val: any) => {
        regionUrlRef.current = val;
        setRegionUrl(val);
      }}
    />
  );
}
