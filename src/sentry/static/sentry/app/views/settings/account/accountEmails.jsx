import {Flex, Box} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {addErrorMessage} from '../../../actionCreators/indicator';
import {t} from '../../../locale';
import AlertLink from '../../../components/alertLink';
import AsyncView from '../../asyncView';
import Button from '../../../components/buttons/button';
import Form from '../components/forms/form';
import JsonForm from '../components/forms/jsonForm';
import Panel from '../components/panel';
import PanelBody from '../components/panelBody';
import PanelHeader from '../components/panelHeader';
import PanelItem from '../components/panelItem';
import SettingsPageHeader from '../components/settingsPageHeader';
import Tag from '../components/tag';
import accountEmailsFields from '../../../data/forms/accountEmails';

const ENDPOINT = '/users/me/emails/';

const RemoveButton = styled(({hidden, ...props}) => (
  <Button priority="danger" size="small" {...props}>
    <span className="icon-trash" />
  </Button>
))`
  ${p => (p.hidden ? 'opacity: 0' : '')};
`;

class EmailRow extends React.Component {
  static propTypes = {
    email: PropTypes.string.isRequired,
    isVerified: PropTypes.bool,
    isPrimary: PropTypes.bool,
    hideRemove: PropTypes.bool,
    onRemove: PropTypes.func,
    onVerify: PropTypes.func,
    onSetPrimary: PropTypes.func,
  };

  handleSetPrimary = e => {
    this.props.onSetPrimary(this.props.email, e);
  };

  handleRemove = e => {
    this.props.onRemove(this.props.email, e);
  };

  handleVerify = e => {
    this.props.onVerify(this.props.email, e);
  };

  render() {
    let {email, isPrimary, isVerified, hideRemove} = this.props;

    return (
      <PanelItem justify="space-between">
        <Flex align="center">
          {email}
          {!isVerified && <Tag priority="warning">{t('Unverified')}</Tag>}
          {isPrimary && <Tag priority="success">{t('Primary')}</Tag>}
        </Flex>
        <Flex>
          {!isPrimary &&
            isVerified && (
              <Button size="small" onClick={this.handleSetPrimary}>
                {t('Set as primary')}
              </Button>
            )}
          {!isVerified && (
            <Button size="small" onClick={this.handleVerify}>
              {t('Resend verification')}
            </Button>
          )}
          {!hideRemove && (
            <Box ml={1}>
              <RemoveButton
                onClick={this.handleRemove}
                hidden={isPrimary || hideRemove}
              />
            </Box>
          )}
        </Flex>
      </PanelItem>
    );
  }
}

class AccountEmails extends AsyncView {
  getEndpoints() {
    return [['emails', ENDPOINT]];
  }

  getTitle() {
    return 'Emails';
  }

  handleSubmitSuccess = (change, model, id) => {
    model.setValue(id, '');
    this.remountComponent();
  };

  handleError = err => {
    this.remountComponent();

    if (err && err.responseJSON && err.responseJSON.email) {
      addErrorMessage(err.responseJSON.email);
    }
  };

  createApiCall = (endpoint, requestParams) => {
    this.setState({loading: true, emails: []}, () => {
      this.api
        .requestPromise(endpoint, requestParams)
        .then(this.remountComponent.bind(this))
        .catch(this.handleError);
    });
  };

  handleSetPrimary = email => {
    this.createApiCall(ENDPOINT, {
      method: 'PUT',
      data: {
        email,
      },
    });
  };

  handleRemove = email => {
    this.createApiCall(ENDPOINT, {
      method: 'DELETE',
      data: {
        email,
      },
    });
  };

  handleVerify = email => {
    this.createApiCall(`${ENDPOINT}confirm/`, {
      method: 'POST',
      data: {
        email,
      },
    });
  };

  renderBody() {
    let {emails} = this.state;
    let primary = emails.find(({isPrimary}) => isPrimary);
    let secondary = emails.filter(({isPrimary}) => !isPrimary);

    return (
      <div>
        <SettingsPageHeader title="Emails" />

        <Panel>
          <PanelHeader>{t('Emails')}</PanelHeader>
          <PanelBody>
            {primary && <EmailRow onRemove={this.handleRemove} {...primary} />}

            {secondary &&
              secondary.map(emailObj => {
                return (
                  <EmailRow
                    key={emailObj.email}
                    onSetPrimary={this.handleSetPrimary}
                    onRemove={this.handleRemove}
                    onVerify={this.handleVerify}
                    {...emailObj}
                  />
                );
              })}
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

        <AlertLink to="/settings/account/notifications" icon="icon-stack">
          {t('Want to change how many emails you get? Use the notifications panel.')}
        </AlertLink>
      </div>
    );
  }
}

export default AccountEmails;
