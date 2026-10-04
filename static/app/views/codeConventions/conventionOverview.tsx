import {useQuery} from '@tanstack/react-query';

import {Disclosure} from '@sentry/scraps/disclosure';
import {Stack} from '@sentry/scraps/layout';
import {Markdown} from '@sentry/scraps/markdown';

import {t} from 'sentry/locale';
import {
  conventionFilesQueryOptions,
  conventionQueryOptions,
  getConventionName,
} from 'sentry/views/codeConventions/utils';

/**
 * The convention's rationale and how it finds violations, collapsed by default
 * so they explain the issue list without pushing it down, and capped at a
 * comfortable reading width.
 */
export function ConventionOverview({conventionName}: {conventionName: string}) {
  const {data: files} = useQuery(conventionFilesQueryOptions);
  const filename = files?.find(
    entry => getConventionName(entry.name) === conventionName
  )?.name;
  const {data: convention} = useQuery(conventionQueryOptions(filename));

  const sections = [
    {key: 'why', title: t('Why this convention matters'), raw: convention?.why},
    {key: 'detect', title: t('How violations are detected'), raw: convention?.detect},
  ].filter(section => section.raw);

  if (sections.length === 0) {
    return null;
  }

  return (
    <Stack gap="md" maxWidth="560px">
      {sections.map(({key, title, raw}) => (
        <Disclosure key={key} size="sm">
          <Disclosure.Title>{title}</Disclosure.Title>
          <Disclosure.Content>
            <Markdown raw={raw!} />
          </Disclosure.Content>
        </Disclosure>
      ))}
    </Stack>
  );
}
