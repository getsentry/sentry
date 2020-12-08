import React from 'react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {RequestOptions} from 'app/api';
import AlertLink from 'app/components/alertLink';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import Tag from 'app/components/tag';
import accountEmailsFields from 'app/data/forms/accountEmails';
import {IconDelete, IconStack} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {UserEmail} from 'app/types';
import AsyncView from 'app/views/asyncView';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';

const ENDPOINT = '/users/me/emails/';

type Props = AsyncView['props'];

type State = AsyncView['state'] & {
  emails: UserEmail[];
};

class AccountEmails extends AsyncView<Props, State> {
  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    return [['emails', ENDPOINT]];
  }

  getTitle() {
    return t('Emails');
  }

  handleSubmitSuccess: Form['props']['onSubmitSuccess'] = (_change, model, id) => {
    if (id === undefined) {
      return;
    }

    model.setValue(id, '');
    this.remountComponent();
  };

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

  renderBody() {
    const {emails} = this.state;
    const primary = emails?.find(({isPrimary}) => isPrimary);
    const secondary = emails?.filter(({isPrimary}) => !isPrimary);

    return (
      <div>
        <SettingsPageHeader title={t('Emails')} />

        <Panel>
          <PanelHeader>{t('Emails')}</PanelHeader>
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

        <Form
          apiMethod="POST"
          apiEndpoint={ENDPOINT}
          saveOnBlur
          allowUndo={false}
          onSubmitSuccess={this.handleSubmitSuccess}
        >
          <JsonForm location={this.props.location} forms={accountEmailsFields} />
        </Form>

        <AlertLink to="/settings/account/notifications" icon={<IconStack />}>
          {t('Want to change how many emails you get? Use the notifications panel.')}
        </AlertLink>
      </div>
    );
  }
}

export default AccountEmails;

type EmailRowProps = {
  email: string;
  onRemove: (email: string, e: React.MouseEvent) => void;
  onVerify: (email: string, e: React.MouseEvent) => void;
  onSetPrimary?: (email: string, e: React.MouseEvent) => void;
  isVerified?: boolean;
  isPrimary?: boolean;
  hideRemove?: boolean;
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
          label={t('Remove email')}
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
  grid-gap: ${space(1)};
  align-items: center;
`;

const EmailItem = styled(PanelItem)`
  justify-content: space-between;
`;
