import {mutationOptions, useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';

import {AutoSaveForm, FieldGroup} from '@sentry/scraps/form';
import {ExternalLink} from '@sentry/scraps/link';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {hasEveryAccess} from 'sentry/components/acl/access';
import {CONTEXT_DOCS_LINK} from 'sentry/components/events/contexts/utils';
import {t, tct} from 'sentry/locale';
import type {DetailedProject} from 'sentry/types/project';
import {convertMultilineFieldValue, extractMultilineFields} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {
  makeDetailedProjectQueryKey,
  useDetailedProject,
} from 'sentry/utils/project/useDetailedProject';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

interface HighlightsSettingsFormProps {
  projectSlug: string;
}

const highlightTagsSchema = z.object({
  highlightTags: z.string().refine(value => value === '' || value.trim() !== '', {
    message: t('Enter at least one tag key or leave the field empty.'),
  }),
});

const highlightContextSchema = z.object({
  highlightContext: z.string().refine(
    value => {
      if (value === '') {
        return true;
      }

      try {
        const parsedValue = JSON.parse(value);
        return (
          parsedValue !== null &&
          typeof parsedValue === 'object' &&
          !Array.isArray(parsedValue)
        );
      } catch {
        return false;
      }
    },
    {message: t('Invalid JSON')}
  ),
});

function serializeHighlightContext(
  highlightContext: DetailedProject['highlightContext']
) {
  if (!highlightContext) {
    return '';
  }

  return JSON.stringify(highlightContext, null, 2);
}

function parseHighlightContext(highlightContext: string) {
  if (highlightContext === '') {
    return {};
  }

  return JSON.parse(highlightContext) as NonNullable<DetailedProject['highlightContext']>;
}

export function HighlightsSettingsForm({projectSlug}: HighlightsSettingsFormProps) {
  const organization = useOrganization();
  const {data: project} = useDetailedProject({
    orgSlug: organization.slug,
    projectSlug,
  });
  const queryClient = useQueryClient();

  if (!project) {
    return null;
  }

  const hasAccess = hasEveryAccess(['project:write'], {organization, project});
  const projectQueryKey = makeDetailedProjectQueryKey({
    orgSlug: organization.slug,
    projectSlug: project.slug,
  });
  const handleSubmitSuccess = (updatedProject: DetailedProject) => {
    queryClient.setQueryData(projectQueryKey, prev => {
      const previous = prev?.json;
      const merged = previous ? {...previous, ...updatedProject} : updatedProject;
      return {headers: prev?.headers ?? {}, json: merged};
    });
    trackAnalytics('highlights.project_settings.updated_manually', {organization});
    addSuccessMessage(`Successfully updated highlights for '${project.name}'`);
  };

  const createProjectUpdateMutationOptions = <TData,>(
    getData: (data: TData) => Partial<DetailedProject>
  ) =>
    mutationOptions({
      mutationFn: (data: TData) =>
        fetchMutation<DetailedProject>({
          url: `/projects/${organization.slug}/${projectSlug}/`,
          method: 'PUT',
          data: getData(data),
        }),
      onSuccess: handleSubmitSuccess,
    });

  const highlightTagsMutationOptions = createProjectUpdateMutationOptions(
    (data: {highlightTags: string}) => ({
      highlightTags: extractMultilineFields(data.highlightTags),
    })
  );

  const highlightContextMutationOptions = createProjectUpdateMutationOptions(
    (data: {highlightContext: string}) => ({
      highlightContext: parseHighlightContext(data.highlightContext),
    })
  );

  return (
    <FieldGroup title={t('Highlights')}>
      <AutoSaveForm
        name="highlightTags"
        schema={highlightTagsSchema}
        initialValue={convertMultilineFieldValue(project.highlightTags)}
        mutationOptions={highlightTagsMutationOptions}
      >
        {field => (
          <field.Layout.Row
            label={t('Highlighted Tags')}
            hintText={t('Separate tag keys with a newline.')}
          >
            <field.TextArea
              value={field.state.value}
              onChange={field.handleChange}
              autosize
              monospace
              rows={1}
              placeholder={t('environment, release, my-tag')}
              disabled={!hasAccess}
            />
          </field.Layout.Row>
        )}
      </AutoSaveForm>

      <AutoSaveForm
        name="highlightContext"
        schema={highlightContextSchema}
        initialValue={serializeHighlightContext(project.highlightContext)}
        mutationOptions={highlightContextMutationOptions}
      >
        {field => (
          <field.Layout.Row
            label={t('Highlighted Context')}
            hintText={tct(
              'Enter a valid JSON entry for mapping [Structured Context] types, to their keys. E.g. [example]',
              {
                link: <ExternalLink openInNewTab href={CONTEXT_DOCS_LINK} />,
                example: '{"user": ["id", "email"]}',
              }
            )}
          >
            <field.TextArea
              value={field.state.value}
              onChange={field.handleChange}
              autosize
              monospace
              rows={1}
              placeholder={t('{"browser": ["name"], "my-ctx": ["my-key"]}')}
              disabled={!hasAccess}
            />
          </field.Layout.Row>
        )}
      </AutoSaveForm>
    </FieldGroup>
  );
}
