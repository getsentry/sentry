import {useState} from 'react';
import {useMutation, useQuery} from '@tanstack/react-query';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Input} from '@sentry/scraps/input';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {AvatarChooser} from 'sentry/components/avatarChooser';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {IconAdd, IconClose} from 'sentry/icons';
import type {DocIntegration, IntegrationFeature} from 'sentry/types/integrations';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useNavigate} from 'sentry/utils/useNavigate';

type Props = ModalRenderProps & {
  docIntegration?: DocIntegration;
  onSubmit?: (docIntegration: DocIntegration) => void;
};

type Resource = {title: string; url: string};
const schema = z.object({
  name: z.string().min(5, 'Name must be at least 5 characters'),
  author: z.string().min(1, 'Author is required'),
  description: z.string(),
  url: z.string().min(1, 'URL is required'),
  popularity: z.number().min(0),
  features: z.array(z.number()).min(1, 'Choose at least one feature'),
});

export function DocIntegrationModal({
  docIntegration,
  Body,
  Header,
  Footer,
  onSubmit,
  closeModal,
}: Props) {
  const navigate = useNavigate();
  const [resources, setResources] = useState<Record<number, Resource>>(() =>
    Object.fromEntries(
      (docIntegration?.resources?.length
        ? docIntegration.resources
        : [{title: '', url: ''}]
      ).map((resource, index) => [index, resource])
    )
  );
  const [nextResourceId, setNextResourceId] = useState(
    docIntegration?.resources?.length ?? 1
  );
  const {
    data: features,
    isError,
    isPending,
    refetch,
  } = useQuery(
    apiOptions.as<IntegrationFeature[]>()('/integration-features/', {staleTime: 0})
  );
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof schema>) =>
      fetchMutation<DocIntegration>({
        url: docIntegration
          ? getApiUrl('/doc-integrations/$docIntegrationIdOrSlug/', {
              path: {docIntegrationIdOrSlug: docIntegration.slug},
            })
          : getApiUrl('/doc-integrations/'),
        method: docIntegration ? 'PUT' : 'POST',
        data: {...values, resources: Object.values(resources)},
      }),
    onSuccess: saved => {
      onSubmit?.(saved);
      if (docIntegration) {
        closeModal();
      } else {
        navigate(`/_admin/doc-integrations/${saved.slug}/`);
      }
    },
    onError: error => {
      const detail =
        error instanceof RequestError ? error.responseJSON?.detail : undefined;
      addErrorMessage(
        typeof detail === 'string' ? detail : 'Unable to save document integration.'
      );
    },
  });
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      name: docIntegration?.name ?? '',
      author: docIntegration?.author ?? '',
      description: docIntegration?.description ?? '',
      url: docIntegration?.url ?? '',
      popularity: docIntegration?.popularity ?? 8,
      features: docIntegration?.features?.map(feature => feature.featureId) ?? [],
    },
    validators: {onDynamic: schema},
    onSubmit: ({value}) => {
      if (Object.values(resources).some(resource => !resource.title || !resource.url)) {
        addErrorMessage(
          'Enter a title and URL for each resource, or remove the empty row.'
        );
        return;
      }
      return mutation.mutateAsync(value).catch(() => {});
    },
  });

  if (isPending) {
    return <LoadingIndicator />;
  }
  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  return (
    <form.AppForm form={form}>
      <Header closeButton>
        <Heading as="h4">
          {docIntegration ? `Edit ${docIntegration.name}` : 'Add New Doc Integration'}
        </Heading>
      </Header>
      <Body>
        <Stack gap="lg">
          <form.AppField name="name">
            {field => (
              <field.Layout.Stack
                label="Name"
                hintText="The name of the document integration."
                required
              >
                <field.Input
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder={docIntegration?.name ?? 'Meow meow'}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="author">
            {field => (
              <field.Layout.Stack
                label="Author"
                hintText="Who maintains this integration?"
                required
              >
                <field.Input
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder={docIntegration?.author ?? 'Hellboy'}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="description">
            {field => (
              <field.Layout.Stack
                label="Description"
                hintText="What does this integration do?"
              >
                <field.TextArea
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder={docIntegration?.description ?? 'A cool cool integration.'}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="url">
            {field => (
              <field.Layout.Stack
                label="URL"
                hintText="The link to the installation document."
                required
              >
                <field.Input
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder={docIntegration?.url ?? 'https://www.meow.com'}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          {Object.entries(resources).map(([id, resource]) => (
            <Flex key={id} gap="lg" align="end">
              <Stack gap="xs" flex="1">
                <Text as="label" size="sm">
                  Resource Title
                </Text>
                <Input
                  aria-label="Resource Title"
                  value={resource.title}
                  placeholder="Report Issue"
                  onChange={event =>
                    setResources(current => ({
                      ...current,
                      [id]: {...resource, title: event.target.value},
                    }))
                  }
                />
              </Stack>
              <Stack gap="xs" flex="1">
                <Text as="label" size="sm">
                  Resource URL
                </Text>
                <Input
                  aria-label="Resource URL"
                  value={resource.url}
                  placeholder="https://example.com/report-issue/"
                  onChange={event =>
                    setResources(current => ({
                      ...current,
                      [id]: {...resource, url: event.target.value},
                    }))
                  }
                />
              </Stack>
              <Button
                variant="transparent"
                icon={<IconClose />}
                size="zero"
                aria-label="Remove resource"
                onClick={() =>
                  setResources(current => {
                    const next = {...current};
                    delete next[Number(id)];
                    return next;
                  })
                }
              />
            </Flex>
          ))}
          <Button
            variant="link"
            icon={<IconAdd size="xs" />}
            onClick={() => {
              setResources(current => ({
                ...current,
                [nextResourceId]: {title: '', url: ''},
              }));
              setNextResourceId(id => id + 1);
            }}
          >
            Add a resource link (e.g. docs, source code, feedback forms)
          </Button>
          <form.AppField name="popularity">
            {field => (
              <field.Layout.Stack
                label="Popularity"
                hintText="Higher values will be more prominent on the integration directory."
                required
              >
                <field.Number
                  value={field.state.value}
                  onChange={value => field.handleChange(value ?? 0)}
                  min={0}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="features">
            {field => (
              <field.Layout.Stack
                label="Features"
                hintText="What features does this integration have?"
                required
              >
                <field.Select
                  multiple
                  value={field.state.value}
                  onChange={field.handleChange}
                  options={features.map(feature => ({
                    value: feature.featureId,
                    label: feature.featureGate.replace(/(^integrations-)/, ''),
                  }))}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          {docIntegration && (
            <AvatarChooser
              type="docIntegration"
              supportedTypes={['upload']}
              endpoint={`/doc-integrations/${docIntegration.slug}/avatar/`}
              model={docIntegration}
              onSave={() => {}}
              title="Logo"
              help="The company's logo"
            />
          )}
        </Stack>
      </Body>
      <Footer>
        <Button onClick={closeModal}>Cancel</Button>
        <form.SubmitButton>{docIntegration ? 'Update' : 'Create'}</form.SubmitButton>
      </Footer>
    </form.AppForm>
  );
}
