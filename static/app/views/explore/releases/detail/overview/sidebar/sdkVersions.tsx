import {skipToken, useQuery} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {Collapsible} from 'sentry/components/collapsible';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import * as SidebarSection from 'sentry/components/sidebarSection';
import {t, tn} from 'sentry/locale';
import type {ReleaseWithHealth} from 'sentry/types/release';
import {percent} from 'sentry/utils';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';

type SdkVersionRow = {
  'count()': number;
  'sdk.name': string;
  'sdk.version': string;
};

type Props = {
  orgSlug: string;
  projectId: string | number;
  release: ReleaseWithHealth;
};

export function SdkVersions({orgSlug, projectId, release}: Props) {
  const hasEvents = Boolean(release.firstEvent && release.lastEvent);

  // lastEvent is truncated to whole seconds, while events carry ms precision.
  const end = new Date(release.lastEvent);
  end.setSeconds(end.getSeconds() + 1);

  const search = new MutableSearch('has:sdk.version');
  search.addFilterValue('release', release.version);

  const {data, isPending, isError} = useQuery(
    apiOptions.as<{data: SdkVersionRow[]}>()(
      '/organizations/$organizationIdOrSlug/events/',
      {
        path: hasEvents ? {organizationIdOrSlug: orgSlug} : skipToken,
        query: {
          referrer: 'api.releases.release-details-sdk-versions',
          dataset: DiscoverDatasets.ERRORS,
          field: ['sdk.name', 'sdk.version', 'count()'],
          query: search.formatString(),
          project: projectId,
          start: release.firstEvent,
          end: hasEvents ? end.toISOString() : undefined,
          sort: '-count()',
          per_page: 20,
        },
        staleTime: 0,
      }
    )
  );

  if (!hasEvents) {
    return null;
  }

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError />;
  }

  if (!data.data.length) {
    return null;
  }

  const total = data.data.reduce((sum, row) => sum + row['count()'], 0);

  return (
    <SidebarSection.Wrap>
      <SidebarSection.Title>{t('SDK Versions')}</SidebarSection.Title>
      <SidebarSection.Content>
        <Stack gap="md">
          <Collapsible
            expandButton={({onExpand, numberOfHiddenItems}) => (
              <Button variant="link" onClick={onExpand}>
                {tn('Show %s other SDK', 'Show %s other SDKs', numberOfHiddenItems)}
              </Button>
            )}
          >
            {data.data.map(row => {
              const rowPercent = Math.round(percent(row['count()'], total));
              return (
                <Flex
                  key={`${row['sdk.name']}@${row['sdk.version']}`}
                  justify="between"
                  gap="md"
                >
                  <Flex gap="md" minWidth="0">
                    <Text ellipsis>{row['sdk.name']}</Text>
                    <Text variant="muted">{row['sdk.version']}</Text>
                  </Flex>
                  <Text>{rowPercent < 1 ? '<1' : rowPercent}%</Text>
                </Flex>
              );
            })}
          </Collapsible>
        </Stack>
      </SidebarSection.Content>
    </SidebarSection.Wrap>
  );
}
