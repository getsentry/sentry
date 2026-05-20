import {mutationOptions} from '@tanstack/react-query';
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
import {useDetailedProject} from 'sentry/utils/project/useDetailedProject';
import {useUpdateProject} from 'sentry/utils/project/useUpdateProject';
import {useOrganization} from 'sentry/utils/useOrganization';

interface HighlightsSettingsFormProps {
  projectSlug: string;
}

const highlightTagsSchema = z.object({
  highlightTags: z.string(),
});

function parseHighlightContextValue(
  value: string
): NonNullable<DetailedProject['highlightContext']> {
  if (value === '') {
    return {};
  }
  return z.record(z.string(), z.array(z.string())).parse(JSON.parse(value));
}

const highlightContextSchema = z.object({
  highlightContext: z.string().superRefine((value, ctx) => {
    try {
      parseHighlightContextValue(value);
    } catch {
      ctx.addIssue({code: 'custom', message: t('Invalid JSON')});
    }
  }),
});

export function HighlightsSettingsForm({projectSlug}: HighlightsSettingsFormProps) {
  const organization = useOrganization();
  const {data: project} = useDetailedProject({
    orgSlug: organization.slug,
    projectSlug,
  });

  if (!project) {
    return null;
  }

  return <LoadedHighlightsSettingsForm project={project} />;
}

interface LoadedHighlightsSettingsFormProps {
  project: DetailedProject;
}

function LoadedHighlightsSettingsForm({project}: LoadedHighlightsSettingsFormProps) {
  const organization = useOrganization();
  const hasAccess = hasEveryAccess(['project:write'], {organization, project});
  const {mutateAsync: updateProject} = useUpdateProject(project);

  const handleSubmitSuccess = () => {
    trackAnalytics('highlights.project_settings.updated_manually', {organization});
    addSuccessMessage(`Successfully updated highlights for '${project.name}'`);
  };

  const highlightTagsMutationOptions = mutationOptions({
    mutationFn: (data: {highlightTags: string}) =>
      updateProject({highlightTags: extractMultilineFields(data.highlightTags)}),
    onSuccess: handleSubmitSuccess,
  });

  const highlightContextMutationOptions = mutationOptions({
    mutationFn: (data: {highlightContext: string}) =>
      updateProject({
        highlightContext: parseHighlightContextValue(data.highlightContext),
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
        initialValue={
          !project.highlightContext || Object.keys(project.highlightContext).length === 0
            ? ''
            : JSON.stringify(project.highlightContext, null, 2)
        }
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
