import {useQuery} from '@tanstack/react-query';

import {Disclosure} from '@sentry/scraps/disclosure';
import {Markdown} from '@sentry/scraps/markdown';

import {t} from 'sentry/locale';
import {
  conventionFilesQueryOptions,
  conventionQueryOptions,
  getConventionName,
} from 'sentry/views/codeConventions/utils';

/**
 * The convention's rationale, collapsed by default so it explains what the
 * issue list is about without pushing the list down.
 */
export function ConventionWhy({conventionName}: {conventionName: string}) {
  const {data: files} = useQuery(conventionFilesQueryOptions);
  const filename = files?.find(
    entry => getConventionName(entry.name) === conventionName
  )?.name;
  const {data: convention} = useQuery(conventionQueryOptions(filename));

  if (!convention?.why) {
    return null;
  }

  return (
    <Disclosure size="sm">
      <Disclosure.Title>{t('Why this convention matters')}</Disclosure.Title>
      <Disclosure.Content>
        <Markdown raw={convention.why} />
      </Disclosure.Content>
    </Disclosure>
  );
}
