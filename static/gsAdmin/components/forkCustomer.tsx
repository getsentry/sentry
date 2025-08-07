import {Component, Fragment} from 'react';

import {Client} from 'sentry/api';
import SelectField from 'sentry/components/forms/fields/selectField';
import type {Organization} from 'sentry/types/organization';
import {browserHistory} from 'sentry/utils/browserHistory';
import {
  getRegionChoices,
  getRegionDataFromOrganization,
  getRegions,
} from 'sentry/utils/regions';

import type {
  AdminConfirmParams,
  AdminConfirmRenderProps,
} from 'admin/components/adminConfirmationModal';

type Props = AdminConfirmRenderProps & {
  organization: Organization;
};

type State = {
  regionUrl: string;
};

/**
 * Rendered as part of a openAdminConfirmModal call
 */
class ForkCustomerAction extends Component<Props> {
  state: State = {
    regionUrl: '',
  };

  componentDidMount() {
    this.props.setConfirmCallback(this.handleConfirm);
  }

  handleConfirm = async (params: AdminConfirmParams) => {
    const api = new Client({headers: {Accept: 'application/json; charset=utf-8'}});
    const {organization} = this.props;
    const {regionUrl} = this.state;
    const regions = getRegions();
    const region = regions.find(r => r.url === regionUrl);

    try {
      const response = await api.requestPromise(
        `/organizations/${organization.slug}/fork/`,
        {
          method: 'POST',
          host: region?.url,
        }
      );

      browserHistory.push(`/_admin/relocations/${region?.name}/${response.uuid}/`);
      this.props.onConfirm?.({regionUrl, ...params});
    } catch (error) {
      if (error.responseJSON) {
        this.props.onConfirm?.({error});
      }
    }
  };

  render() {
    const {organization} = this.props;
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
          value={this.state.regionUrl}
          onChange={(val: any) => this.setState({regionUrl: val})}
        />
      </Fragment>
    );
  }
}

export default ForkCustomerAction;
