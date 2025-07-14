import {Button} from 'sentry/components/core/button';
import {ExternalLink} from 'sentry/components/core/link';
import type {DocsParams} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {IconCopy} from 'sentry/icons/iconCopy';
import {t, tct} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getSourceMapsWizardSnippet} from 'sentry/utils/getSourceMapsWizardSnippet';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';

export function getUploadSourceMapsStep({
  guideLink,
  organization,
  platformKey,
  projectId,
  newOrg,
  isSelfHosted,
  description,
  projectSlug,
}: DocsParams & {
  description?: React.ReactNode;
  guideLink?: string;
}) {
  return {
    collapsible: true,
    title: t('Upload Source Maps (Optional)'),
    description: description ?? (
      <p>
        {tct(
          'Automatically upload your source maps to enable readable stack traces for Errors. If you prefer to manually set up source maps, please follow [guideLink:this guide].',
          {
            guideLink: <ExternalLink href={guideLink} />,
          }
        )}
      </p>
    ),
    configurations: [
      {
        language: 'bash',
        code: getSourceMapsWizardSnippet({
          isSelfHosted,
          organization,
          projectSlug,
        }),
        onCopy: () => {
          if (!organization || !projectId || !platformKey) {
            return;
          }

          trackAnalytics(
            newOrg
              ? 'onboarding.source_maps_wizard_button_copy_clicked'
              : 'project_creation.source_maps_wizard_button_copy_clicked',
            {
              project_id: projectId,
              platform: platformKey,
              organization,
            }
          );
        },
        onSelectAndCopy: () => {
          if (!organization || !projectId || !platformKey) {
            return;
          }

          trackAnalytics(
            newOrg
              ? 'onboarding.source_maps_wizard_selected_and_copied'
              : 'project_creation.source_maps_wizard_selected_and_copied',
            {
              project_id: projectId,
              platform: platformKey,
              organization,
            }
          );
        },
      },
    ],
  };
}

function CopyRulesButton({rules}: {rules: string}) {
  const {onClick} = useCopyToClipboard({text: rules});
  return (
    <Button size="xs" icon={<IconCopy />} onClick={onClick}>
      {t('Copy Rules')}
    </Button>
  );
}

export function getAIRulesForCodeEditorStep({rules}: {rules: string}) {
  return {
    collapsible: true,
    title: t('AI Rules for Code Editors (Optional)'),
    description: tct(
      'Sentry provides a set of rules you can use to help your LLM use Sentry correctly. Copy this file and add it to your projects rules configuration. When created as a rules file this should be placed alongside other editor specific rule files. For example, if you are using Cursor, place this file in the [code:.cursorrules] directory.',
      {
        code: <code />,
      }
    ),
    trailingItems: <CopyRulesButton rules={rules} />,
    configurations: [
      {
        code: [
          {
            label: 'Markdown',
            value: 'md',
            language: 'md',
            filename: 'rules.md',
            code: rules,
          },
        ],
      },
    ],
  };
}
