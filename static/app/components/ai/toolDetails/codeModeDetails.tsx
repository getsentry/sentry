import {skipToken, useQuery} from '@tanstack/react-query';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import {areAiFeaturesAllowed} from 'sentry/utils/seer/areAiFeaturesAllowed';
import {useOrganization} from 'sentry/utils/useOrganization';

import {CodeModeInput} from './codeModeInput';

// Matches the endpoint's limit, which counts code points rather than UTF-16 units.
const MAX_CODE_LENGTH = 4_000;

function trimCode(code: string): string {
  if (code.length <= MAX_CODE_LENGTH) {
    return code;
  }
  return Array.from(code).slice(0, MAX_CODE_LENGTH).join('');
}

interface Props {
  code: string;
  projectId: number;
  language?: string;
}

export function CodeModeDetails({code, language, projectId}: Props) {
  const organization = useOrganization();
  const requestLanguage = language?.trim() || 'javascript';
  const requestCode = trimCode(code);
  const canExplain =
    areAiFeaturesAllowed(organization) &&
    Boolean(projectId) &&
    requestCode.trim().length > 0 &&
    requestLanguage.length <= 64;
  const {data, isLoading} = useQuery({
    ...apiOptions.as<{summary: string}>()(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/ai/code-explanation/',
      {
        path: canExplain
          ? {organizationIdOrSlug: organization.slug, projectIdOrSlug: projectId}
          : skipToken,
        method: 'POST',
        data: canExplain ? {code: requestCode, language: requestLanguage} : undefined,
        staleTime: 24 * 60 * 60 * 1000,
      }
    ),
    retry: false,
  });

  return (
    <CodeModeInput
      code={code}
      language={language}
      summary={canExplain ? data?.summary : undefined}
      isSummaryLoading={canExplain && isLoading}
    />
  );
}
