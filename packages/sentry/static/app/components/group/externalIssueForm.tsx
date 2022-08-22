import * as Sentry from '@sentry/react';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import AsyncComponent from 'sentry/components/asyncComponent';
import AbstractExternalIssueForm, {
  ExternalIssueAction,
} from 'sentry/components/externalIssues/abstractExternalIssueForm';
import Form from 'sentry/components/forms/form';
import NavTabs from 'sentry/components/navTabs';
import {t, tct} from 'sentry/locale';
import {Group, Integration, IntegrationExternalIssue} from 'sentry/types';

const MESSAGES_BY_ACTION = {
  link: t('Successfully linked issue.'),
  create: t('Successfully created issue.'),
};

const SUBMIT_LABEL_BY_ACTION = {
  link: t('Link Issue'),
  create: t('Create Issue'),
};

type Props = {
  group: Group;
  integration: Integration;
  onChange: (onSuccess?: () => void, onError?: () => void) => void;
} & AbstractExternalIssueForm['props'];

type State = AbstractExternalIssueForm['state'];

export default class ExternalIssueForm extends AbstractExternalIssueForm<Props, State> {
  loadTransaction?: ReturnType<typeof Sentry.startTransaction>;
  submitTransaction?: ReturnType<typeof Sentry.startTransaction>;

  constructor(props) {
    super(props, {});
    this.loadTransaction = this.startTransaction('load');
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const query: {action?: ExternalIssueAction} = {};
    if (this.state?.hasOwnProperty('action')) {
      query.action = this.state.action;
    }
    return [['integrationDetails', this.getEndPointString(), {query}]];
  }

  handleClick = (action: ExternalIssueAction) => {
    this.setState({action}, () => this.reloadData());
  };

  startTransaction = (type: 'load' | 'submit') => {
    const {group, integration} = this.props;
    const {action} = this.state;
    const transaction = Sentry.startTransaction({name: `externalIssueForm.${type}`});
    Sentry.getCurrentHub().configureScope(scope => scope.setSpan(transaction));
    transaction.setTag('issueAction', action);
    transaction.setTag('groupID', group.id);
    transaction.setTag('projectID', group.project.id);
    transaction.setTag('integrationSlug', integration.provider.slug);
    transaction.setTag('integrationType', 'firstParty');
    return transaction;
  };

  handlePreSubmit = () => {
    this.submitTransaction = this.startTransaction('submit');
  };

  onSubmitSuccess = (_data: IntegrationExternalIssue): void => {
    const {onChange, closeModal} = this.props;
    const {action} = this.state;
    onChange(() => addSuccessMessage(MESSAGES_BY_ACTION[action]));
    closeModal();

    this.submitTransaction?.finish();
  };

  handleSubmitError = () => {
    this.submitTransaction?.finish();
  };

  onLoadAllEndpointsSuccess = () => {
    this.loadTransaction?.finish();
  };

  onRequestError = () => {
    this.loadTransaction?.finish();
  };

  getEndPointString() {
    const {group, integration} = this.props;
    return `/groups/${group.id}/integrations/${integration.id}/`;
  }

  getTitle = () => {
    const {integration} = this.props;
    return tct('[integration] Issue', {integration: integration.provider.name});
  };

  getFormProps = (): Form['props'] => {
    const {action} = this.state;
    return {
      ...this.getDefaultFormProps(),
      submitLabel: SUBMIT_LABEL_BY_ACTION[action],
      apiEndpoint: this.getEndPointString(),
      apiMethod: action === 'create' ? 'POST' : 'PUT',
      onPreSubmit: this.handlePreSubmit,
      onSubmitError: this.handleSubmitError,
      onSubmitSuccess: this.onSubmitSuccess,
    };
  };

  renderNavTabs = () => {
    const {action} = this.state;
    return (
      <NavTabs underlined>
        <li className={action === 'create' ? 'active' : ''}>
          <a onClick={() => this.handleClick('create')}>{t('Create')}</a>
        </li>
        <li className={action === 'link' ? 'active' : ''}>
          <a onClick={() => this.handleClick('link')}>{t('Link')}</a>
        </li>
      </NavTabs>
    );
  };

  renderBody() {
    return this.renderForm(this.getCleanedFields());
  }
}
