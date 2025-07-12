import {Fragment, useEffect, useState} from 'react';

import SelectField from 'sentry/components/forms/fields/selectField';
import type {Organization} from 'sentry/types/organization';
import {useMutation} from 'sentry/utils/queryClient';
import {
  getRegionChoices,
  getRegionDataFromOrganization,
  getRegions,
} from 'sentry/utils/regions';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
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
export default function ForkCustomerAction({
  organization,
  onConfirm,
  setConfirmCallback,
}: Props) {
  const [regionUrl, setRegionUrl] = useState('');
  const api = useApi({persistInFlight: true});
  const navigate = useNavigate();

  const {mutate} = useMutation<any, RequestError, AdminConfirmParams>({
    mutationFn: () => {
      const regions = getRegions();
      const region = regions.find(r => r.url === regionUrl);

      return api.requestPromise(`/organizations/${organization.slug}/fork/`, {
        method: 'POST',
        host: region?.url,
      });
    },
    onSuccess: (response, params) => {
      const regions = getRegions();
      const region = regions.find(r => r.url === regionUrl);
      navigate(`/_admin/relocations/${region?.name}/${response.uuid}/`);
      onConfirm?.({regionUrl, ...params});
    },
    onError: (error: RequestError, _params) => {
      if (error.responseJSON) {
        onConfirm?.({error});
      }
    },
  });

  useEffect(() => {
    setConfirmCallback(mutate);
  }, [mutate, setConfirmCallback]);

  const currentRegionData = getRegionDataFromOrganization(organization);
  const regionChoices = getRegionChoices(currentRegionData ? [currentRegionData] : []);

  return (
    <Fragment>
      <SelectField
        name="regionUrl"
        label={'Duplicate into Region'}
        help={
          "Choose which region to duplicate this organization's low volume metadata into. This will kick off a SAAS->SAAS relocation job, but the source organization will not be affected."
        }
        choices={regionChoices}
        inline={false}
        stacked
        required
        value={regionUrl}
        onChange={(val: any) => setRegionUrl(val)}
      />
    </Fragment>
  );
}
