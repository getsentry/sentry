import {useQuery} from '@tanstack/react-query';

import {Disclosure} from '@sentry/scraps/disclosure';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Markdown} from '@sentry/scraps/markdown';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {ConventionCost} from 'sentry/views/codeConventions/conventionCost';
import {ScheduleText} from 'sentry/views/codeConventions/conventionSchedule';
import {ConventionTags} from 'sentry/views/codeConventions/conventionTags';
import {
  conventionFilesQueryOptions,
  conventionQueryOptions,
  getConventionName,
  getConventionSchedule,
} from 'sentry/views/codeConventions/utils';

/**
 * Context for a convention's issue list: its rationale and how it finds
 * violations, collapsed by default and capped at a comfortable reading width,
 * beside its schedule, cost and tags. The details wrap below on narrow screens.
 */
export function ConventionOverview({conventionName}: {conventionName: string}) {
  const {data: files} = useQuery(conventionFilesQueryOptions);
  const filename = files?.find(
    entry => getConventionName(entry.name) === conventionName
  )?.name;
  const {data: convention} = useQuery(conventionQueryOptions(filename));

  if (!filename || !convention) {
    return null;
  }

  const sections = [
    {key: 'why', title: t('Why this convention matters'), raw: convention.why},
    {key: 'detect', title: t('How violations are detected'), raw: convention.detect},
  ].filter(section => section.raw);

  return (
    <Flex gap="2xl" wrap="wrap" align="start">
      {sections.length > 0 ? (
        <Stack gap="md" flex="1 1 320px" maxWidth="560px">
          {sections.map(({key, title, raw}) => (
            <Disclosure key={key} size="sm">
              <Disclosure.Title>{title}</Disclosure.Title>
              <Disclosure.Content>
                <Markdown raw={raw!} />
              </Disclosure.Content>
            </Disclosure>
          ))}
        </Stack>
      ) : null}
      <Grid columns="max-content auto" gap="md lg" align="center">
        <Text variant="muted">{t('Schedule')}</Text>
        <ScheduleText schedule={getConventionSchedule(convention)} />
        <Text variant="muted">{t('LLM cost (30d)')}</Text>
        <ConventionCost filename={filename} />
        <Text variant="muted">{t('Tags')}</Text>
        <ConventionTags filename={filename} />
      </Grid>
    </Flex>
  );
}
