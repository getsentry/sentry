import type {Span} from '@sentry/core';
import * as Sentry from '@sentry/react';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import type DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import type {ExternalIssueAction} from 'sentry/components/externalIssues/abstractExternalIssueForm';
import AbstractExternalIssueForm from 'sentry/components/externalIssues/abstractExternalIssueForm';
import type {FormProps} from 'sentry/components/forms/form';
import NavTabs from 'sentry/components/navTabs';
import {t, tct} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Integration, IntegrationExternalIssue} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getAnalyticsDataForGroup} from 'sentry/utils/events';

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
  organization: Organization;
} & AbstractExternalIssueForm['props'];

type State = AbstractExternalIssueForm['state'];

export default class ExternalIssueForm extends AbstractExternalIssueForm<Props, State> {
  loadSpan: Span | undefined;
  submitSpan: Span | undefined;
  trackedLoadStatus = false;

  constructor(props: any) {
    super(props, {});
    this.loadSpan = this.startSpan('load');
  }

  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    const query: {action?: ExternalIssueAction} = {};
    if (this.state?.hasOwnProperty('action')) {
      query.action = this.state.action;
    }
    return [['integrationDetails', this.getEndPointString(), {query}]];
  }

  handleClick = (action: ExternalIssueAction) => {
    this.setState({action}, () => this.reloadData());
  };

  startSpan = (type: 'load' | 'submit') => {
    const {group, integration} = this.props;
    const {action} = this.state;

    const span = Sentry.withScope(scope => {
      scope.setTag('issueAction', action);
      scope.setTag('groupID', group.id);
      scope.setTag('projectID', group.project.id);
      scope.setTag('integrationSlug', integration.provider.slug);
      scope.setTag('integrationType', 'firstParty');

      return Sentry.startInactiveSpan({
        name: `externalIssueForm.${type}`,
        forceTransaction: true,
      });
    });

    return span;
  };

  handlePreSubmit = () => {
    this.submitSpan = this.startSpan('submit');
  };

  onSubmitSuccess = (_data: IntegrationExternalIssue): void => {
    const {onChange, closeModal} = this.props;
    const {action} = this.state;

    trackAnalytics('issue_details.external_issue_created', {
      organization: this.props.organization,
      ...getAnalyticsDataForGroup(this.props.group),
      external_issue_provider: this.props.integration.provider.key,
      external_issue_type: 'first_party',
    });

    onChange(() => addSuccessMessage(MESSAGES_BY_ACTION[action]));
    closeModal();

    this.submitSpan?.end();
  };

  handleSubmitError = () => {
    this.submitSpan?.end();
  };

  trackLoadStatus = (success: boolean) => {
    if (this.trackedLoadStatus) {
      return;
    }

    this.trackedLoadStatus = true;
    trackAnalytics('issue_details.external_issue_loaded', {
      organization: this.props.organization,
      ...getAnalyticsDataForGroup(this.props.group),
      external_issue_provider: this.props.integration.provider.key,
      external_issue_type: 'first_party',
      success,
    });
  };

  onLoadAllEndpointsSuccess = () => {
    this.loadSpan?.end();
    this.trackLoadStatus(true);
  };

  onRequestError = () => {
    this.loadSpan?.end();
    this.trackLoadStatus(false);
  };

  getEndPointString() {
    const {group, integration, organization} = this.props;
    return `/organizations/${organization.slug}/issues/${group.id}/integrations/${integration.id}/`;
  }

  getTitle = () => {
    const {integration} = this.props;
    return tct('[integration] Issue', {integration: integration.provider.name});
  };

  getFormProps = (): FormProps => {
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
    return this.renderForm(this.loadAsyncThenFetchAllFields());
  }
}
