import {Component} from 'react';
import {css} from '@emotion/react';
import isEqual from 'lodash/isEqual';
import isFunction from 'lodash/isFunction';

import {Alert} from '@sentry/scraps/alert';
import {LinkButton} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import {Form} from 'sentry/components/deprecatedforms/form';
import {GenericField} from 'sentry/components/deprecatedforms/genericField';
import {FormState} from 'sentry/components/forms/state';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t, tct} from 'sentry/locale';
import type {Plugin} from 'sentry/types/integrationsBase';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {parseRepo} from 'sentry/utils/git/parseRepo';
import {isScmPlugin, trackIntegrationAnalytics} from 'sentry/utils/integrationUtil';

const callbackWithArgs = function (context: any, callback: any, ...args: any) {
  return isFunction(callback) ? callback.bind(context, ...args) : undefined;
};

type GenericFieldProps = Parameters<typeof GenericField>[0];

type Props = {
  organization: Organization;
  plugin: Plugin;
  project: Project;
};

type Field = GenericFieldProps['config'];

type BackendField = Field & {defaultValue?: any; value?: any};

type State = {
  errors: Record<string, any>;
  fieldList: Field[] | null;
  formData: Record<string, any>;
  initialData: Record<string, any> | null;
  rawData: Record<string, any>;
  state: FormState;
  wasConfiguredOnPageLoad: boolean;
};

export class PluginSettings<
  P extends Props = Props,
  S extends State = State,
> extends Component<P, S> {
  constructor(props: P) {
    super(props);

    [
      'onLoadSuccess',
      'onLoadError',
      'onSave',
      'onSaveSuccess',
      'onSaveError',
      'onSaveComplete',
      'renderField',
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    ].map(method => (this[method] = this[method].bind(this)));

    if (this.fetchData) {
      this.fetchData = this.onLoad.bind(this, this.fetchData.bind(this));
    }
    if (this.onSubmit) {
      this.onSubmit = this.onSave.bind(this, this.onSubmit.bind(this));
    }

    this.state = {
      state: FormState.LOADING,
      fieldList: null,
      initialData: null,
      formData: null,
      errors: {},
      rawData: {},
      wasConfiguredOnPageLoad: false,
    } as unknown as Readonly<S>;
  }

  componentDidMount() {
    this.fetchData();
  }

  componentWillUnmount() {
    this.api.clear();
    window.clearTimeout(this.successMessageTimeout);
    window.clearTimeout(this.errorMessageTimeout);
  }

  successMessageTimeout: number | undefined = undefined;
  errorMessageTimeout: number | undefined = undefined;

  api = new Client();

  trackPluginEvent = (
    eventKey:
      | 'integrations.installation_start'
      | 'integrations.installation_complete'
      | 'integrations.config_saved'
  ) => {
    const baseParams = {
      integration: this.props.plugin.id,
      integration_type: 'plugin' as const,
      view: 'plugin_details' as const,
      already_installed: this.state.wasConfiguredOnPageLoad,
      organization: this.props.organization,
    };
    if (eventKey === 'integrations.config_saved') {
      trackIntegrationAnalytics(eventKey, baseParams);
      return;
    }
    trackIntegrationAnalytics(eventKey, {
      ...baseParams,
      is_scm: isScmPlugin(this.props.plugin),
    });
  };

  getPluginEndpoint() {
    const org = this.props.organization;
    const project = this.props.project;
    return `/projects/${org.slug}/${project.slug}/plugins/${this.props.plugin.id}/`;
  }

  changeField(name: string, value: any) {
    // eslint-disable-next-line @sentry/no-unnecessary-type-annotation
    const formData: State['formData'] = this.state.formData;
    formData[name] = value;
    const errors = this.state.errors;
    delete errors[name];
    this.setState({formData, errors});
  }

  onLoad(callback: any, ...args: any[]) {
    this.setState(
      {
        state: FormState.LOADING,
      },
      callbackWithArgs(this, callback, ...args)
    );
  }

  onLoadSuccess() {
    this.setState({
      state: FormState.READY,
    });
  }

  onLoadError(callback: any, ...args: any[]) {
    this.setState(
      {
        state: FormState.ERROR,
      },
      callbackWithArgs(this, callback, ...args)
    );
    addErrorMessage(t('An error occurred.'));
  }

  onSave(callback: any, ...args: any[]) {
    if (this.state.state === FormState.SAVING) {
      return;
    }
    callback = callbackWithArgs(this, callback, ...args);
    this.setState(
      {
        state: FormState.SAVING,
      },
      () => {
        addLoadingMessage(t('Saving changes…'));
        callback?.();
      }
    );
  }

  onSaveSuccess(callback: any, ...args: any[]) {
    callback = callbackWithArgs(this, callback, ...args);
    this.setState(
      {
        state: FormState.READY,
      },
      () => callback?.()
    );

    window.clearTimeout(this.successMessageTimeout);
    this.successMessageTimeout = window.setTimeout(() => {
      addSuccessMessage(t('Success!'));
    }, 0);
  }

  onSaveError(callback: any, ...args: any[]) {
    callback = callbackWithArgs(this, callback, ...args);
    this.setState(
      {
        state: FormState.ERROR,
      },
      () => callback?.()
    );

    window.clearTimeout(this.errorMessageTimeout);
    this.errorMessageTimeout = window.setTimeout(() => {
      addErrorMessage(t('Unable to save changes. Please try again.'));
    }, 0);
  }

  onSaveComplete(callback: any, ...args: any[]) {
    clearIndicators();
    callback = callbackWithArgs(this, callback, ...args);
    callback?.();
  }

  onSubmit() {
    if (!this.state.wasConfiguredOnPageLoad) {
      this.trackPluginEvent('integrations.installation_start');
    }

    let repo = this.state.formData.repo;
    repo = repo && parseRepo(repo);
    const parsedFormData = {...this.state.formData, repo};
    this.api.request(this.getPluginEndpoint(), {
      data: parsedFormData,
      method: 'PUT',
      success: this.onSaveSuccess.bind(this, (data: any) => {
        const formData = {};
        const initialData = {};
        data.config.forEach((field: any) => {
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          formData[field.name] = field.value || field.defaultValue;
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          initialData[field.name] = field.value;
        });
        this.setState({
          fieldList: data.config,
          formData,
          initialData,
          errors: {},
        });
        this.trackPluginEvent('integrations.config_saved');

        if (!this.state.wasConfiguredOnPageLoad) {
          this.trackPluginEvent('integrations.installation_complete');
        }
      }),
      error: this.onSaveError.bind(this, (error: any) => {
        this.setState({
          errors: error.responseJSON?.errors || {},
        });
      }),
      complete: this.onSaveComplete,
    });
  }

  fetchData() {
    this.api.request(this.getPluginEndpoint(), {
      success: data => {
        if (!data.config) {
          this.setState(
            {
              rawData: data,
            },
            this.onLoadSuccess
          );
          return;
        }
        let wasConfiguredOnPageLoad = false;
        const formData = {};
        const initialData = {};
        data.config.forEach((field: BackendField) => {
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          formData[field.name] = field.value || field.defaultValue;
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          initialData[field.name] = field.value;
          wasConfiguredOnPageLoad = wasConfiguredOnPageLoad || !!field.value;
        });
        this.setState(
          {
            fieldList: data.config,
            formData,
            initialData,
            wasConfiguredOnPageLoad,
          },
          this.onLoadSuccess
        );
      },
      error: this.onLoadError,
    });
  }

  renderField(props: Omit<GenericFieldProps, 'formState'>): React.ReactNode {
    props = {...props};
    const newProps = {
      ...props,
      formState: this.state.state,
    };
    return <GenericField key={newProps.config?.name} {...newProps} />;
  }

  render() {
    if (this.state.state === FormState.LOADING) {
      return <LoadingIndicator />;
    }
    const isSaving = this.state.state === FormState.SAVING;
    const hasChanges = !isEqual(this.state.initialData, this.state.formData);

    const data = this.state.rawData;
    if (data.config_error) {
      let authUrl = data.auth_url;
      if (authUrl.includes('?')) {
        authUrl += '&next=' + encodeURIComponent(document.location.pathname);
      } else {
        authUrl += '?next=' + encodeURIComponent(document.location.pathname);
      }
      return (
        <div className="m-b-1">
          <Alert.Container>
            <Alert variant="warning" showIcon={false}>
              {data.config_error}
            </Alert>
          </Alert.Container>
          <LinkButton variant="primary" href={authUrl}>
            {t('Associate Identity')}
          </LinkButton>
        </div>
      );
    }

    if (this.state.state === FormState.ERROR && !this.state.fieldList) {
      return (
        <Alert.Container>
          <Alert variant="danger" showIcon={false}>
            {tct(
              'An unknown error occurred. Need help with this? [link:Contact support]',
              {
                link: <a href="https://sentry.io/support/" />,
              }
            )}
          </Alert>
        </Alert.Container>
      );
    }

    const fieldList = this.state.fieldList;

    if (!fieldList?.length) {
      return null;
    }
    return (
      <Form
        css={css`
          width: 100%;
        `}
        onSubmit={this.onSubmit}
        submitDisabled={isSaving || !hasChanges}
      >
        <Stack>
          {this.state.errors.__all__ && (
            <Alert variant="danger" showIcon={false}>
              <ul>
                <li>{this.state.errors.__all__}</li>
              </ul>
            </Alert>
          )}
          {this.state.fieldList?.map(f =>
            this.renderField({
              config: f,
              formData: this.state.formData,
              formErrors: this.state.errors,
              onChange: this.changeField.bind(this, f.name),
            })
          )}
        </Stack>
      </Form>
    );
  }
}
