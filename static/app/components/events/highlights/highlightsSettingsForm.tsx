import {hasEveryAccess} from 'sentry/components/acl/access';
import {CONTEXT_DOCS_LINK} from 'sentry/components/events/contextSummary/utils';
import JsonForm from 'sentry/components/forms/jsonForm';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import {convertMultilineFieldValue, extractMultilineFields} from 'sentry/utils';
import {useDetailedProject} from 'sentry/utils/useDetailedProject';
import useOrganization from 'sentry/utils/useOrganization';

interface HighlightsSettingsFormProps {
  projectSlug;
}

export default function HighlightsSettingsForm({
  projectSlug,
}: HighlightsSettingsFormProps) {
  const organization = useOrganization();
  const {data: project} = useDetailedProject({orgSlug: organization.slug, projectSlug});
  if (!organization.features.includes('event-tags-tree-ui') || !project) {
    return null;
  }
  const access = new Set(organization.access.concat(project.access));
  return (
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
  );
}
