import {Fragment} from 'react';
import {IconAdd} from '@sentry/icons/add';
import {IconClose} from '@sentry/icons/close';
import {useMutation, useQuery} from '@tanstack/react-query';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, setFieldErrors, useScrapsForm} from '@sentry/scraps/form';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import type {ModalRenderProps} from '@sentry/scraps/modal';
import {toast} from '@sentry/scraps/toast';

import {AvatarChooser} from 'sentry/components/avatarChooser';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import type {DocIntegration, IntegrationFeature} from 'sentry/types/integrations';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {getRequestErrorUserMessage} from 'sentry/utils/requestError/getRequestErrorUserMessage';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {requestErrorToFieldErrors} from 'sentry/utils/requestError/requestErrorToFieldErrors';
import {useNavigate} from 'sentry/utils/useNavigate';

const schema = z.object({
  name: z.string().min(5, 'Name must be at least 5 characters'),
  author: z.string().min(1, 'Author is required'),
  description: z.string(),
  url: z.string().min(1, 'URL is required'),
  resources: z.array(
    z.object({
      title: z.string().min(1, 'Resource title is required'),
      url: z.string().min(1, 'Resource URL is required'),
    })
  ),
  popularity: z
    .number()
    .nullable()
    .refine(value => value !== null, 'Popularity is required'),
  features: z.array(z.number()).min(1, 'Select at least one feature'),
});

type DocIntegrationPayload = Pick<
  DocIntegration,
  'name' | 'author' | 'description' | 'url' | 'popularity'
> & {features: number[]; resources: Array<{title: string; url: string}>};

const EMPTY_RESOURCE = {title: '', url: ''};

type Props = ModalRenderProps & {
  docIntegration?: DocIntegration;
  onSubmit?: (docIntegration: DocIntegration) => void;
};

export function DocIntegrationModal(props: Props) {
  const {
    docIntegration,
    Body,
    Footer,
    Header,
    onSubmit: propsOnSubmit,
    closeModal,
  } = props;
  const navigate = useNavigate();

  const {
    data: features,
    isError,
    isPending,
    refetch,
  } = useQuery(
    apiOptions.as<IntegrationFeature[]>()('/integration-features/', {staleTime: 0})
  );

  const mutation = useMutation({
    mutationFn: (data: DocIntegrationPayload) =>
      fetchMutation<DocIntegration>({
        url: docIntegration
          ? getApiUrl('/doc-integrations/$docIntegrationIdOrSlug/', {
              path: {docIntegrationIdOrSlug: docIntegration.slug},
            })
          : getApiUrl('/doc-integrations/'),
        method: docIntegration ? 'PUT' : 'POST',
        data,
      }),
    onMutate: () => {
      toast.loading('Saving changes…');
    },
    onSettled: () => {
      toast.dismiss();
    },
    onSuccess: newDocIntegration => {
      propsOnSubmit?.(newDocIntegration);
      if (docIntegration) {
        closeModal();
      } else {
        navigate(`/_admin/doc-integrations/${newDocIntegration.slug}/`);
      }
    },
  });

  const defaultValues: z.input<typeof schema> = {
    name: docIntegration?.name ?? '',
    author: docIntegration?.author ?? '',
    description: docIntegration?.description ?? '',
    url: docIntegration?.url ?? '',
    resources: docIntegration?.resources ?? [EMPTY_RESOURCE],
    popularity: docIntegration?.popularity ?? null,
    features: docIntegration?.features?.map(({featureId}) => featureId) ?? [],
  };

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    validators: {onDynamic: schema},
    onSubmit: async ({value, formApi}) => {
      try {
        await mutation.mutateAsync(schema.parse(value));
      } catch (error) {
        const handled =
          error instanceof RequestError &&
          setFieldErrors(formApi, requestErrorToFieldErrors(error, formApi.state.values));
        if (!handled) {
          toast.error(getRequestErrorUserMessage(error, 'Unknown error while saving'));
        }
      }
    },
  });

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  const featureOptions = features.map(({featureId, featureGate}) => ({
    value: featureId,
    label: featureGate.replace(/(^integrations-)/, ''),
  }));

  return (
    <form.AppForm form={form}>
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
        <Stack gap="xl">
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
                  placeholder={docIntegration ? docIntegration.name : 'Meow meow'}
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
                  placeholder={docIntegration ? docIntegration.author : 'Hellboy'}
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
                  placeholder={
                    docIntegration
                      ? docIntegration.description
                      : 'A cool cool integration.'
                  }
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
                  placeholder={
                    docIntegration ? docIntegration.url : 'https://www.meow.com'
                  }
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="resources" mode="array">
            {resourcesField => (
              <Stack gap="xl" align="start">
                {resourcesField.state.value.map((_, i) => (
                  <Flex gap="xl" key={i} width="100%">
                    <Container flex={1}>
                      <form.AppField name={`resources[${i}].title`}>
                        {field => (
                          <field.Layout.Stack
                            label="Resource Title"
                            hintText="The title of the resource."
                            required
                          >
                            <field.Input
                              value={field.state.value}
                              onChange={field.handleChange}
                              placeholder="Report Issue"
                            />
                          </field.Layout.Stack>
                        )}
                      </form.AppField>
                    </Container>
                    <Container flex={1}>
                      <form.AppField name={`resources[${i}].url`}>
                        {field => (
                          <field.Layout.Stack
                            label="Resource URL"
                            hintText="A link to the resource."
                            required
                          >
                            <field.Input
                              value={field.state.value}
                              onChange={field.handleChange}
                              placeholder="https://www.meow.com/report-issue/"
                            />
                          </field.Layout.Stack>
                        )}
                      </form.AppField>
                    </Container>
                    <Container paddingTop="3xl">
                      <Button
                        variant="transparent"
                        icon={<IconClose />}
                        size="zero"
                        onClick={() => resourcesField.removeValue(i)}
                        aria-label="Close"
                      />
                    </Container>
                  </Flex>
                ))}
                <Button
                  variant="link"
                  onClick={() => resourcesField.pushValue(EMPTY_RESOURCE)}
                  icon={<IconAdd size="xs" />}
                >
                  Add a resource link (e.g. docs, source code, feedback forms)
                </Button>
              </Stack>
            )}
          </form.AppField>
          <form.AppField name="popularity">
            {field => (
              <field.Layout.Stack
                label="Popularity"
                hintText="Higher values will be more prominent on the integration directory."
                required
              >
                <field.Number
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder={docIntegration ? String(docIntegration.popularity) : '8'}
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
                  options={featureOptions}
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
        <form.SubmitButton>{docIntegration ? 'Update' : 'Create'}</form.SubmitButton>
      </Footer>
    </form.AppForm>
  );
}
