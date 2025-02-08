import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {hasEveryAccess} from 'sentry/components/acl/access';
import {CONTEXT_DOCS_LINK} from 'sentry/components/events/contexts/utils';
import Form, {type FormProps} from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {convertMultilineFieldValue, extractMultilineFields} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {setApiQueryData, useQueryClient} from 'sentry/utils/queryClient';
import {
  makeDetailedProjectQueryKey,
  useDetailedProject,
} from 'sentry/utils/useDetailedProject';
import useOrganization from 'sentry/utils/useOrganization';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

interface HighlightsSettingsFormProps {
  projectSlug: any;
}

export default function HighlightsSettingsForm({
  projectSlug,
}: HighlightsSettingsFormProps) {
  const organization = useOrganization();
  const {data: project} = useDetailedProject({
    orgSlug: organization.slug,
    projectSlug,
  });
  const queryClient = useQueryClient();
  if (!project) {
    return null;
  }
  const access = new Set(organization.access.concat(project.access));
  const formProps: FormProps = {
    saveOnBlur: true,
    allowUndo: true,
    initialData: {
      highlightTags: project.highlightTags,
      highlightContext: project.highlightContext,
    },
    apiMethod: 'PUT',
    apiEndpoint: `/projects/${organization.slug}/${projectSlug}/`,
    onSubmitSuccess: (updatedProject: Project) => {
      setApiQueryData<Project>(
        queryClient,
        makeDetailedProjectQueryKey({
          orgSlug: organization.slug,
          projectSlug: project.slug,
        }),
        data => (updatedProject ? updatedProject : data)
      );
      trackAnalytics('highlights.project_settings.updated_manually', {organization});
      addSuccessMessage(`Successfully updated highlights for '${project.name}'`);
    },
  };
  return (
    <Form {...formProps}>
      <TextBlock>
        {t(
          `Setup Highlights to promote your event data to the top of the issue page for quicker debugging.`
        )}
      </TextBlock>
      <JsonForm
        access={access}
        disabled={!hasEveryAccess(['project:write'], {organization, project})}
        title={t('Highlights')}
        fields={[
          {
            name: 'highlightTags',
            type: 'string',
            multiline: true,
            autosize: true,
            rows: 1,
            placeholder: t('environment, release, my-tag'),
            label: t('Highlighted Tags'),
            help: t('Separate tag keys with a newline.'),
            getValue: val => extractMultilineFields(val),
            setValue: val => convertMultilineFieldValue(val),
          },
          {
            name: 'highlightContext',
            type: 'textarea',
            multiline: true,
            autosize: true,
            rows: 1,
            placeholder: t('{"browser": ["name"], "my-ctx": ["my-key"]}'),
            label: t('Highlighted Context'),
            help: tct(
              'Enter a valid JSON entry for mapping [Structured Context] types, to their keys. E.g. [example]',
              {
                link: <ExternalLink openInNewTab href={CONTEXT_DOCS_LINK} />,
                example: '{"user": ["id", "email"]}',
              }
            ),
            getValue: (val: string) => (val === '' ? {} : JSON.parse(val)),
            setValue: (val: string) => {
              const schema = JSON.stringify(val, null, 2);
              if (schema === '{}') {
                return '';
              }
              return schema;
            },
            validate: ({id, form}) => {
              if (form.highlightContext) {
                try {
                  JSON.parse(form.highlightContext);
                } catch (e) {
                  return [[id, 'Invalid JSON']];
                }
              }
              return [];
            },
          },
        ]}
      />
    </Form>
  );
}
