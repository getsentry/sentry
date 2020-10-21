import {RouteComponentProps} from 'react-router/lib/Router';
import { Component, Fragment } from 'react';

import {Client} from 'app/api';
import {Panel, PanelAlert, PanelBody, PanelHeader} from 'app/components/panels';
import {ProjectKey} from 'app/views/settings/project/projectKeys/types';
import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'app/actionCreators/indicator';
import {t, tct} from 'app/locale';
import Access from 'app/components/acl/access';
import BooleanField from 'app/views/settings/components/forms/booleanField';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import DateTime from 'app/components/dateTime';
import ExternalLink from 'app/components/links/externalLink';
import Field from 'app/views/settings/components/forms/field';
import Form from 'app/views/settings/components/forms/form';
import {IconFlag} from 'app/icons';
import KeyRateLimitsForm from 'app/views/settings/project/projectKeys/details/keyRateLimitsForm';
import ProjectKeyCredentials from 'app/views/settings/project/projectKeys/projectKeyCredentials';
import SelectField from 'app/views/settings/components/forms/selectField';
import TextCopyInput from 'app/views/settings/components/forms/textCopyInput';
import TextField from 'app/views/settings/components/forms/textField';
import getDynamicText from 'app/utils/getDynamicText';

type Props = {
  api: Client;
  data: ProjectKey;
  onRemove: () => void;
} & Pick<
  RouteComponentProps<
    {
      keyId: string;
      orgId: string;
      projectId: string;
    },
    {}
  >,
  'params'
>;

type State = {
  loading: boolean;
  error: boolean;
};

class KeySettings extends Component<Props, State> {
  state = {
    loading: false,
    error: false,
  };

  handleRemove = async () => {
    if (this.state.loading) {
      return;
    }

    addLoadingMessage(t('Revoking key\u2026'));
    const {api, onRemove, params} = this.props;
    const {keyId, orgId, projectId} = params;

    try {
      await api.requestPromise(`/projects/${orgId}/${projectId}/keys/${keyId}/`, {
        method: 'DELETE',
      });

      onRemove();
      addSuccessMessage(t('Revoked key'));
    } catch (_err) {
      this.setState({
        error: true,
        loading: false,
      });
      addErrorMessage(t('Unable to revoke key'));
    }
  };

  render() {
    const {keyId, orgId, projectId} = this.props.params;
    const {data} = this.props;
    const apiEndpoint = `/projects/${orgId}/${projectId}/keys/${keyId}/`;
    const loaderLink = getDynamicText({
      value: data.dsn.cdn,
      fixed: '__JS_SDK_LOADER_URL__',
    });

    return (
      <Access access={['project:write']}>
        {({hasAccess}) => (
          <Fragment>
            <Form
              saveOnBlur
              allowUndo
              apiEndpoint={apiEndpoint}
              apiMethod="PUT"
              initialData={data}
            >
              <Panel>
                <PanelHeader>{t('Details')}</PanelHeader>

                <PanelBody>
                  <TextField
                    name="name"
                    label={t('Name')}
                    disabled={!hasAccess}
                    required={false}
                    maxLength={64}
                  />
                  <BooleanField
                    name="isActive"
                    label={t('Enabled')}
                    required={false}
                    disabled={!hasAccess}
                    help="Accept events from this key? This may be used to temporarily suspend a key."
                  />
                  <Field label={t('Created')}>
                    <div className="controls">
                      <DateTime date={data.dateCreated} />
                    </div>
                  </Field>
                </PanelBody>
              </Panel>
            </Form>

            <KeyRateLimitsForm
              params={this.props.params}
              data={data}
              disabled={!hasAccess}
            />

            <Form saveOnBlur apiEndpoint={apiEndpoint} apiMethod="PUT" initialData={data}>
              <Panel>
                <PanelHeader>{t('JavaScript Loader')}</PanelHeader>
                <PanelBody>
                  <Field
                    help={tct(
                      'Copy this script into your website to setup your JavaScript SDK without any additional configuration. [link]',
                      {
                        link: (
                          <ExternalLink href="https://docs.sentry.io/platforms/javascript/#what-does-the-loader-provide">
                            What does the script provide?
                          </ExternalLink>
                        ),
                      }
                    )}
                    inline={false}
                    flexibleControlStateSize
                  >
                    <TextCopyInput>
                      {`<script src='${loaderLink}' crossorigin="anonymous"></script>`}
                    </TextCopyInput>
                  </Field>
                  <SelectField
                    deprecatedSelectControl
                    name="browserSdkVersion"
                    choices={data.browserSdk ? data.browserSdk.choices : []}
                    placeholder={t('4.x')}
                    allowClear={false}
                    enabled={!hasAccess}
                    help={t(
                      'Select the version of the SDK that should be loaded. Note that it can take a few minutes until this change is live.'
                    )}
                  />
                </PanelBody>
              </Panel>
            </Form>

            <Panel>
              <PanelHeader>{t('Credentials')}</PanelHeader>
              <PanelBody>
                <PanelAlert type="info" icon={<IconFlag size="md" />}>
                  {t(
                    'Your credentials are coupled to a public and secret key. Different clients will require different credentials, so make sure you check the documentation before plugging things in.'
                  )}
                </PanelAlert>

                <ProjectKeyCredentials
                  projectId={`${data.projectId}`}
                  data={data}
                  showPublicKey
                  showSecretKey
                  showProjectId
                />
              </PanelBody>
            </Panel>

            <Access access={['project:admin']}>
              <Panel>
                <PanelHeader>{t('Revoke Key')}</PanelHeader>
                <PanelBody>
                  <Field
                    label={t('Revoke Key')}
                    help={t(
                      'Revoking this key will immediately remove and suspend the credentials. This action is irreversible.'
                    )}
                  >
                    <div>
                      <Confirm
                        priority="danger"
                        message={t(
                          'Are you sure you want to revoke this key? This will immediately remove and suspend the credentials.'
                        )}
                        onConfirm={this.handleRemove}
                        confirmText={t('Revoke Key')}
                      >
                        <Button priority="danger">{t('Revoke Key')}</Button>
                      </Confirm>
                    </div>
                  </Field>
                </PanelBody>
              </Panel>
            </Access>
          </Fragment>
        )}
      </Access>
    );
  }
}

export default KeySettings;
