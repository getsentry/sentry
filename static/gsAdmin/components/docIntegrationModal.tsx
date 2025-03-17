import {Fragment} from 'react';
import styled from '@emotion/styled';

import {addLoadingMessage, clearIndicators} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import AvatarChooser from 'sentry/components/avatarChooser';
import {Button} from 'sentry/components/core/button';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import NumberField from 'sentry/components/forms/fields/numberField';
import SelectField from 'sentry/components/forms/fields/selectField';
import TextareaField from 'sentry/components/forms/fields/textareaField';
import TextField from 'sentry/components/forms/fields/textField';
import Form from 'sentry/components/forms/form';
import {IconAdd, IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {DocIntegration, IntegrationFeature} from 'sentry/types/integrations';
import {browserHistory} from 'sentry/utils/browserHistory';

const fieldProps = {
  stacked: true,
  inline: false,
  flexibleControlStateSize: true,
} as const;

type Props = ModalRenderProps &
  DeprecatedAsyncComponent['props'] & {
    docIntegration?: DocIntegration;
    onSubmit?: (docIntegration: DocIntegration) => void;
  };

type State = DeprecatedAsyncComponent['state'] & {
  features: IntegrationFeature[];
  lastResourceId: number;
  resources: {[id: number]: {title?: string; url?: string}};
};

class DocIntegrationModal extends DeprecatedAsyncComponent<Props, State> {
  getDefaultState(): State {
    const {docIntegration} = this.props;
    return {
      ...this.state,
      features: [],
      resources: {...(docIntegration?.resources ?? {0: {}})},
      lastResourceId: docIntegration?.resources?.length ?? 0,
    };
  }

  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    return [['features', `/integration-features/`]];
  }

  getFeatures(): Array<[number, string]> {
    const {features} = this.state;
    if (!features) {
      return [];
    }
    return features.map(({featureId, featureGate}) => [
      featureId,
      featureGate.replace(/(^integrations-)/, ''),
    ]);
  }

  renderResourceSection() {
    const {resources} = this.state;

    const resourceRows = Object.entries(resources).map(([id, entry]) => (
      <ResourceContainer key={id}>
        <ResourceTextField
          {...fieldProps}
          name={`___resource-title-${id}`}
          label="Resource Title"
          placeholder="Report Issue"
          help="The title of the resource."
          required
          onChange={(value: any) => {
            this.setState({
              resources: {
                ...this.state.resources,
                [id]: {...entry, title: value},
              },
            });
          }}
        />
        <ResourceTextField
          {...fieldProps}
          name={`___resource-url-${id}`}
          label="Resource URL"
          placeholder="https://www.meow.com/report-issue/"
          help="A link to the resource."
          required
          onChange={(value: any) => {
            this.setState({
              resources: {
                ...this.state.resources,
                [id]: {...entry, url: value},
              },
            });
          }}
        />
        <RemoveButton
          borderless
          icon={<IconClose />}
          size="zero"
          onClick={e => {
            e.preventDefault();
            this.setState(state => {
              const existingResources = {...state.resources};
              delete existingResources[id as unknown as number];
              return {resources: existingResources};
            });
          }}
          aria-label={t('Close')}
        />
      </ResourceContainer>
    ));
    resourceRows.push(
      <AddButton
        priority="link"
        onClick={e => {
          e.preventDefault();
          this.setState({
            resources: {
              ...this.state.resources,
              [this.state.lastResourceId + 1]: {},
            },
            lastResourceId: this.state.lastResourceId + 1,
          });
        }}
        icon={<IconAdd size="xs" isCircled />}
        key="add-button"
      >
        Add a resource link (e.g. docs, source code, feedback forms)
      </AddButton>
    );
    return resourceRows;
  }

  getInitialData() {
    const {docIntegration} = this.props;
    // The form uses the 'name' attribute to track what to send as a payload.
    // Unfortunately, we can't send `resource-title-0` to the API, so we ignore
    // remove those fields when sending data, and only use them to load defaults
    const resourceFields = Object.entries(this.state.resources).reduce(
      (previousFields, [currentId, currentResource]) => {
        return {
          ...previousFields,
          [`___resource-title-${currentId}`]: currentResource.title,
          [`___resource-url-${currentId}`]: currentResource.url,
        };
      },
      {}
    );
    return {
      ...docIntegration,
      ...resourceFields,
      features: docIntegration?.features?.map(({featureId}) => featureId),
    };
  }

  /**
   * This function prepares the outgoing data to match what the API is expecting
   * @param data The form data
   */
  prepareData(data: Record<string, any>) {
    const outgoingData = {...data};
    // Remove any ignored fields (e.g. ResourceTextFields that saved to the form model)
    Object.keys(outgoingData).forEach(field => {
      if (field.startsWith('___')) {
        delete outgoingData[field];
      }
    });
    // We're using the 'resources' data from state since we have onChange calls
    // on those fields, See renderResourceSection()
    outgoingData.resources = Object.values(this.state.resources);
    return outgoingData;
  }

  onSubmit = (
    data: Record<string, any>,
    onSuccess: (response: Record<string, any>) => void,
    onError: (error: any) => void
  ) => {
    const {docIntegration} = this.props;
    addLoadingMessage(t('Saving changes\u2026'));
    this.api.request(
      docIntegration ? `/doc-integrations/${docIntegration.slug}/` : '/doc-integrations/',
      {
        method: docIntegration ? 'PUT' : 'POST',
        data: this.prepareData(data),
        success: response => {
          clearIndicators();
          onSuccess(response);
        },
        error: error => {
          clearIndicators();
          onError(error);
        },
      }
    );
  };

  render() {
    const {Body, Header, docIntegration, onSubmit, closeModal} = this.props;
    return (
      <Fragment>
        <Header closeButton>
          {docIntegration ? (
            <Fragment>
              Edit <b>{docIntegration.name}</b>
            </Fragment>
          ) : (
            'Add New Doc Integration'
          )}
        </Header>
        <Body>
          <Form
            onSubmit={this.onSubmit}
            onSubmitSuccess={(newDocIntegration: DocIntegration) => {
              if (onSubmit) {
                onSubmit(newDocIntegration);
              }
              if (docIntegration) {
                closeModal();
              } else {
                browserHistory.push(
                  `/_admin/doc-integrations/${newDocIntegration.slug}/`
                );
              }
            }}
            initialData={this.getInitialData()}
            submitLabel={docIntegration ? 'Update' : 'Create'}
          >
            <TextField
              {...fieldProps}
              name="name"
              label="Name"
              placeholder={docIntegration ? docIntegration.name : 'Meow meow'}
              help="The name of the document integration."
              minLength={5}
              required
            />
            <TextField
              {...fieldProps}
              name="author"
              label="Author"
              placeholder={docIntegration ? docIntegration.author : 'Hellboy'}
              help="Who maintains this integration?"
              required
            />
            <TextareaField
              {...fieldProps}
              name="description"
              label="Description"
              placeholder={
                docIntegration ? docIntegration.description : 'A cool cool integration.'
              }
              help="What does this integration do?"
            />
            <TextField
              {...fieldProps}
              name="url"
              label="URL"
              placeholder={docIntegration ? docIntegration.url : 'https://www.meow.com'}
              help="The link to the installation document."
              required
            />
            {this.renderResourceSection()}
            <NumberField
              {...fieldProps}
              name="popularity"
              label="Popularity"
              placeholder={docIntegration ? docIntegration.popularity : 8}
              help="Higher values will be more prominent on the integration directory."
              required
            />
            <SelectField
              {...fieldProps}
              multiple
              name="features"
              label="Features"
              help="What features does this integration have?"
              choices={this.getFeatures()}
              required
            />
            {docIntegration && (
              <AvatarChooser
                type="docIntegration"
                allowGravatar={false}
                allowLetter={false}
                endpoint={`/doc-integrations/${docIntegration.slug}/avatar/`}
                model={docIntegration.avatar ? docIntegration : {}}
                onSave={() => {}}
                title="Logo"
                help={"The company's logo"}
              />
            )}
          </Form>
        </Body>
      </Fragment>
    );
  }
}

const AddButton = styled(Button)`
  margin-bottom: ${space(2)};
`;

const RemoveButton = styled(Button)`
  margin-top: ${space(4)};
`;

const ResourceContainer = styled('div')`
  display: flex;
  gap: ${space(2)};
`;

const ResourceTextField = styled(TextField)`
  flex: 1;
`;

export default DocIntegrationModal;
