import {Component, Fragment} from 'react';

import {Alert} from 'sentry/components/core/alert';
import SelectField from 'sentry/components/forms/fields/selectField';

import type {
  AdminConfirmParams,
  AdminConfirmRenderProps,
} from 'admin/components/adminConfirmationModal';
import type {Subscription} from 'getsentry/types';

type Props = AdminConfirmRenderProps & {
  subscription: Subscription;
};

type State = {
  sponsoredType?: string | null;
};

/**
 * Rendered as part of a openAdminConfirmModal call
 */
class SponsorshipAction extends Component<Props, State> {
  state: State = {
    sponsoredType: undefined,
  };

  componentDidMount() {
    this.props.setConfirmCallback(this.handleConfirm);
    this.props.disableConfirmButton(true);
  }

  handleChange = (value: string | null) => {
    this.props.disableConfirmButton(!value);
    this.setState({sponsoredType: value});
  };

  handleConfirm = (_params: AdminConfirmParams) => {
    const {sponsoredType} = this.state;
    const {onConfirm} = this.props;

    const data = {sponsoredType};
    onConfirm?.(data);
  };

  render() {
    const {subscription} = this.props;
    const {sponsoredType} = this.state;

    if (!subscription) {
      return null;
    }

    return (
      <Fragment>
        {subscription.isSponsored && (
          <Alert.Container>
            <Alert variant="info">This account is already sponsored.</Alert>
          </Alert.Container>
        )}
        <SelectField
          required
          inline={false}
          stacked
          flexibleControlStateSize
          label="Sponsored Type"
          name="sponsored-type"
          value={sponsoredType}
          onChange={(val: any) => val && this.handleChange(val)}
          choices={[
            ['education', 'Education'],
            ['open_source', 'Open source'],
            ['non_profit', 'Non-profit'],
            ['employee', 'Employee'],
            ['friends_and_family', 'Friends and family'],
          ]}
        />
      </Fragment>
    );
  }
}

export default SponsorshipAction;
