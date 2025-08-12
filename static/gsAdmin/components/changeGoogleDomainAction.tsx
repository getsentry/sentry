import {Component, Fragment} from 'react';

import {addLoadingMessage, clearIndicators} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import type {Client} from 'sentry/api';
import SelectField from 'sentry/components/forms/fields/selectField';
import TextField from 'sentry/components/forms/fields/textField';
import Form from 'sentry/components/forms/form';
import withApi from 'sentry/utils/withApi';

type Props = {
  api: Client;
  onUpdated: (data: any) => void;
  orgId: string;
};

const CHANGE_CHOICES = [
  ['swap', 'Swap'],
  ['add', 'Add'],
] as const;

type ModalProps = Props & ModalRenderProps;

type ModalState = {
  append: string | null;
  dryRun: boolean | null;
  dryRunInfo: any[];
  loading: boolean;
};

class ChangeGoogleDomainModal extends Component<ModalProps, ModalState> {
  state: ModalState = {
    loading: false,
    append: null,
    dryRun: true,
    dryRunInfo: [],
  };

  onActionSuccess(domain: string) {
    this.props.closeModal();
    this.props.onUpdated({newDomain: domain});
  }

  onActionError(error: string) {
    this.props.closeModal();
    this.props.onUpdated({error});
  }

  onSubmit = async (obj: any) => {
    const {orgId} = this.props;
    const {dryRun} = this.state;
    const {newDomain, append} = obj;

    const data = {append, newDomain, dryRun};

    addLoadingMessage();

    try {
      const result = await this.props.api.requestPromise(
        `/customers/${orgId}/migrate-google-domain/`,
        {method: 'POST', data}
      );

      if (dryRun) {
        this.setState({dryRunInfo: result.dryrun_info, dryRun: false});
      } else {
        this.onActionSuccess(result.new_domain);
      }
    } catch (error: any) {
      this.onActionError(error);
    }

    clearIndicators();
  };

  renderDryRunInfo() {
    return this.state.dryRunInfo.map(i => (
      <li style={{listStyle: 'none'}} key={i}>
        {i}
      </li>
    ));
  }

  render() {
    const {Header, Body} = this.props;
    const {loading, dryRun, dryRunInfo} = this.state;

    if (loading) {
      return null;
    }

    return (
      <Fragment>
        <Header>Change Google Domain</Header>
        <Body>
          <Form
            onSubmit={this.onSubmit}
            submitLabel={dryRun ? 'Do Dry Run' : 'Update Google Domain(s)'}
          >
            <TextField
              inline={false}
              stacked
              label="New Domain"
              name="newDomain"
              placeholder="new domain"
              flexibleControlStateSize
              required
            />
            <SelectField
              inline={false}
              stacked
              label="Change Option"
              name="append"
              choices={CHANGE_CHOICES}
              required
              flexibleControlStateSize
              onChange={(v: string) => this.setState({append: v})}
            />
          </Form>
          {dryRunInfo.length > 0 && (
            <pre>
              <p>Test Run</p>
              {this.renderDryRunInfo()}
            </pre>
          )}
        </Body>
      </Fragment>
    );
  }
}

const Modal = withApi(ChangeGoogleDomainModal);

type Options = Pick<Props, 'orgId' | 'onUpdated'>;

const triggerGoogleDomainModal = (opts: Options) =>
  openModal(deps => <Modal {...deps} {...opts} />);

export default triggerGoogleDomainModal;
