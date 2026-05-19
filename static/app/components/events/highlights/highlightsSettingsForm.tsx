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
  highlightTags: z.string(),
});

const highlightContextSchema = z.object({
  highlightContext: z.string().refine(
    value => {
      if (value === '') {
        return true;
      }

      try {
        JSON.parse(value);
        return true;
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
  if (!highlightContext || Object.keys(highlightContext).length === 0) {
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
  const projectEndpoint = `/projects/${organization.slug}/${projectSlug}/`;

  const handleSubmitSuccess = (updatedProject: DetailedProject) => {
    queryClient.setQueryData(projectQueryKey, prev => {
      const previous = prev?.json;
      const merged = previous ? {...previous, ...updatedProject} : updatedProject;
      return {headers: prev?.headers ?? {}, json: merged};
    });
    trackAnalytics('highlights.project_settings.updated_manually', {organization});
    addSuccessMessage(`Successfully updated highlights for '${project.name}'`);
  };

  const highlightTagsMutationOptions = mutationOptions({
    mutationFn: (data: {highlightTags: string}) =>
      fetchMutation<DetailedProject>({
        url: projectEndpoint,
        method: 'PUT',
        data: {highlightTags: extractMultilineFields(data.highlightTags)},
      }),
    onSuccess: handleSubmitSuccess,
  });

  const highlightContextMutationOptions = mutationOptions({
    mutationFn: (data: {highlightContext: string}) =>
      fetchMutation<DetailedProject>({
        url: projectEndpoint,
        method: 'PUT',
        data: {highlightContext: parseHighlightContext(data.highlightContext)},
      }),
    onSuccess: handleSubmitSuccess,
  });

  return (
    <FieldGroup title={t('Highlights')}>
      <AutoSaveForm
        name="highlightTags"
        schema={highlightTagsSchema}
        initialValue={convertMultilineFieldValue(project.highlightTags)}
        mutationOptions={highlightTagsMutationOptions}
      >
        {field => (
          <field.Layout.Stack
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
          </field.Layout.Stack>
        )}
      </AutoSaveForm>

      <AutoSaveForm
        name="highlightContext"
        schema={highlightContextSchema}
        initialValue={serializeHighlightContext(project.highlightContext)}
        mutationOptions={highlightContextMutationOptions}
      >
        {field => (
          <field.Layout.Stack
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
          </field.Layout.Stack>
        )}
      </AutoSaveForm>
    </FieldGroup>
  );
}
