import * as React from 'react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {RequestOptions} from 'sentry/api';
import AlertLink from 'sentry/components/alertLink';
import AsyncComponent from 'sentry/components/asyncComponent';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'sentry/components/panels';
import Tag from 'sentry/components/tag';
import accountEmailsFields from 'sentry/data/forms/accountEmails';
import {IconDelete, IconStack} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {UserEmail} from 'sentry/types';
import AsyncView from 'sentry/views/asyncView';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

const ENDPOINT = '/users/me/emails/';

type Props = AsyncView['props'];

type State = AsyncView['state'] & {
  emails: UserEmail[];
};

class AccountEmails extends AsyncView<Props, State> {
  getTitle() {
    return t('Emails');
  }

  getEndpoints() {
    return [];
  }

  handleSubmitSuccess: Form['props']['onSubmitSuccess'] = (_change, model, id) => {
    if (id === undefined) {
      return;
    }
    model.setValue(id, '');
    this.remountComponent();
  };

  renderBody() {
    return (
      <React.Fragment>
        <SettingsPageHeader title={t('Email Addresses')} />
        <EmailAddresses />
        <Form
          apiMethod="POST"
          apiEndpoint={ENDPOINT}
          saveOnBlur
          allowUndo={false}
          onSubmitSuccess={this.handleSubmitSuccess}
        >
          <JsonForm forms={accountEmailsFields} />
        </Form>

        <AlertLink to="/settings/account/notifications" icon={<IconStack />}>
          {t('Want to change how many emails you get? Use the notifications panel.')}
        </AlertLink>
      </React.Fragment>
    );
  }
}

export default AccountEmails;

export class EmailAddresses extends AsyncComponent<Props, State> {
  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    return [['emails', ENDPOINT]];
  }
  doApiCall(endpoint: string, requestParams: RequestOptions) {
    this.setState({loading: true, emails: []}, () =>
      this.api
        .requestPromise(endpoint, requestParams)
        .then(() => this.remountComponent())
        .catch(err => {
          this.remountComponent();

          if (err?.responseJSON?.email) {
            addErrorMessage(err.responseJSON.email);
          }
        })
    );
  }
  handleSetPrimary = (email: string) =>
    this.doApiCall(ENDPOINT, {
      method: 'PUT',
      data: {email},
    });

  handleRemove = (email: string) =>
    this.doApiCall(ENDPOINT, {
      method: 'DELETE',
      data: {email},
    });

  handleVerify = (email: string) =>
    this.doApiCall(`${ENDPOINT}confirm/`, {
      method: 'POST',
      data: {email},
    });

  render() {
    const {emails, loading} = this.state;
    const primary = emails?.find(({isPrimary}) => isPrimary);
    const secondary = emails?.filter(({isPrimary}) => !isPrimary);

    if (loading) {
      return (
        <Panel>
          <PanelHeader>{t('Email Addresses')}</PanelHeader>
          <PanelBody>
            <LoadingIndicator />
          </PanelBody>
        </Panel>
      );
    }
    return (
      <Panel>
        <PanelHeader>{t('Email Addresses')}</PanelHeader>
        <PanelBody>
          {primary && (
            <EmailRow
              onRemove={this.handleRemove}
              onVerify={this.handleVerify}
              {...primary}
            />
          )}

          {secondary?.map(emailObj => (
            <EmailRow
              key={emailObj.email}
              onSetPrimary={this.handleSetPrimary}
              onRemove={this.handleRemove}
              onVerify={this.handleVerify}
              {...emailObj}
            />
          ))}
        </PanelBody>
      </Panel>
    );
  }
}

type EmailRowProps = {
  email: string;
  onRemove: (email: string, e: React.MouseEvent) => void;
  onVerify: (email: string, e: React.MouseEvent) => void;
  hideRemove?: boolean;
  isPrimary?: boolean;
  isVerified?: boolean;
  onSetPrimary?: (email: string, e: React.MouseEvent) => void;
};

const EmailRow = ({
  email,
  onRemove,
  onVerify,
  onSetPrimary,
  isVerified,
  isPrimary,
  hideRemove,
}: EmailRowProps) => (
  <EmailItem>
    <EmailTags>
      {email}
      {!isVerified && <Tag type="warning">{t('Unverified')}</Tag>}
      {isPrimary && <Tag type="success">{t('Primary')}</Tag>}
    </EmailTags>
    <ButtonBar gap={1}>
      {!isPrimary && isVerified && (
        <Button size="small" onClick={e => onSetPrimary?.(email, e)}>
          {t('Set as primary')}
        </Button>
      )}
      {!isVerified && (
        <Button size="small" onClick={e => onVerify(email, e)}>
          {t('Resend verification')}
        </Button>
      )}
      {!hideRemove && !isPrimary && (
        <Button
          aria-label={t('Remove email')}
          data-test-id="remove"
          priority="danger"
          size="small"
          icon={<IconDelete />}
          onClick={e => onRemove(email, e)}
        />
      )}
    </ButtonBar>
  </EmailItem>
);

const EmailTags = styled('div')`
  display: grid;
  grid-auto-flow: column;
  gap: ${space(1)};
  align-items: center;
`;

const EmailItem = styled(PanelItem)`
  justify-content: space-between;
`;
