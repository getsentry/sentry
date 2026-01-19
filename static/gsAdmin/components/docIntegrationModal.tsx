import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {addLoadingMessage, clearIndicators} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import AvatarChooser from 'sentry/components/avatarChooser';
import {Button} from 'sentry/components/core/button';
import NumberField from 'sentry/components/forms/fields/numberField';
import SelectField from 'sentry/components/forms/fields/selectField';
import TextareaField from 'sentry/components/forms/fields/textareaField';
import TextField from 'sentry/components/forms/fields/textField';
import Form from 'sentry/components/forms/form';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconAdd, IconClose} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import type {DocIntegration, IntegrationFeature} from 'sentry/types/integrations';
import {useApiQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';

const fieldProps = {
  stacked: true,
  inline: false,
  flexibleControlStateSize: true,
} as const;

type Props = ModalRenderProps & {
  docIntegration?: DocIntegration;
  onSubmit?: (docIntegration: DocIntegration) => void;
};

function DocIntegrationModal(props: Props) {
  const {docIntegration, Body, Header, onSubmit: propsOnSubmit, closeModal} = props;
  const api = useApi({persistInFlight: true});
  const navigate = useNavigate();

  const [resources, setResources] = useState<
    Record<number, {title?: string; url?: string}>
  >({...(docIntegration?.resources ?? {0: {}})});
  const [lastResourceId, setLastResourceId] = useState(
    docIntegration?.resources?.length ?? 0
  );

  const {
    data: features,
    isError,
    isPending,
    refetch,
  } = useApiQuery<IntegrationFeature[]>([`/integration-features/`], {staleTime: 0});

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  const getFeatures = (): Array<[number, string]> => {
    if (!features) {
      return [];
    }
    return features.map(({featureId, featureGate}) => [
      featureId,
      featureGate.replace(/(^integrations-)/, ''),
    ]);
  };

  const renderResourceSection = () => {
    const resourceRows = Object.entries(resources).map(([id, entry]) => (
      <Flex gap="xl" key={id}>
        <ResourceTextField
          {...fieldProps}
          name={`___resource-title-${id}`}
          label="Resource Title"
          placeholder="Report Issue"
          help="The title of the resource."
          required
          onChange={(value: any) => {
            setResources({
              ...resources,
              [id]: {...entry, title: value},
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
            setResources({
              ...resources,
              [id]: {...entry, url: value},
            });
          }}
        />
        <RemoveButton
          borderless
          icon={<IconClose />}
          size="zero"
          onClick={e => {
            e.preventDefault();
            setResources(state => {
              const existingResources = {...state};
              delete existingResources[id as unknown as number];
              return existingResources;
            });
          }}
          aria-label="Close"
        />
      </Flex>
    ));
    resourceRows.push(
      <AddButton
        priority="link"
        onClick={e => {
          e.preventDefault();
          setResources(state => ({
            ...state,
            [lastResourceId + 1]: {},
          }));
          setLastResourceId(lastResourceId + 1);
        }}
        icon={<IconAdd size="xs" />}
        key="add-button"
      >
        Add a resource link (e.g. docs, source code, feedback forms)
      </AddButton>
    );
    return resourceRows;
  };

  const getInitialData = () => {
    // The form uses the 'name' attribute to track what to send as a payload.
    // Unfortunately, we can't send `resource-title-0` to the API, so we ignore
    // remove those fields when sending data, and only use them to load defaults
    const resourceFields = Object.entries(resources).reduce(
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
  };

  /**
   * This function prepares the outgoing data to match what the API is expecting
   * @param data The form data
   */
  const prepareData = (data: Record<string, any>) => {
    const outgoingData = {...data};
    // Remove any ignored fields (e.g. ResourceTextFields that saved to the form model)
    Object.keys(outgoingData).forEach(field => {
      if (field.startsWith('___')) {
        delete outgoingData[field];
      }
    });
    // We're using the 'resources' data from state since we have onChange calls
    // on those fields, See renderResourceSection()
    outgoingData.resources = Object.values(resources);
    return outgoingData;
  };

  const onSubmit = (
    data: Record<string, any>,
    onSuccess: (response: Record<string, any>) => void,
    onError: (error: any) => void
  ) => {
    addLoadingMessage('Saving changes\u2026');
    api.request(
      docIntegration ? `/doc-integrations/${docIntegration.slug}/` : '/doc-integrations/',
      {
        method: docIntegration ? 'PUT' : 'POST',
        data: prepareData(data),
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
          onSubmit={onSubmit}
          onSubmitSuccess={(newDocIntegration: DocIntegration) => {
            if (propsOnSubmit) {
              propsOnSubmit(newDocIntegration);
            }
            if (docIntegration) {
              closeModal();
            } else {
              navigate(`/_admin/doc-integrations/${newDocIntegration.slug}/`);
            }
          }}
          initialData={getInitialData()}
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
          {renderResourceSection()}
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
            choices={getFeatures()}
            required
          />
          {docIntegration && (
            <AvatarChooser
              type="docIntegration"
              supportedTypes={['upload']}
              endpoint={`/doc-integrations/${docIntegration.slug}/avatar/`}
              model={docIntegration.avatar ? docIntegration : {}}
              onSave={() => {}}
              title="Logo"
              help="The company's logo"
            />
          )}
        </Form>
      </Body>
    </Fragment>
  );
}

const AddButton = styled(Button)`
  margin-bottom: ${space(2)};
`;

const RemoveButton = styled(Button)`
  margin-top: ${space(4)};
`;

const ResourceTextField = styled(TextField)`
  flex: 1;
`;

export default DocIntegrationModal;
