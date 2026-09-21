import {useContext} from 'react';
import {useInfiniteQuery} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {Collapsible} from 'sentry/components/collapsible';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import * as SidebarSection from 'sentry/components/sidebarSection';
import {t, tn} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {useFetchAllPages} from 'sentry/utils/api/apiFetch';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {useLocation} from 'sentry/utils/useLocation';
import {ReleaseContext} from 'sentry/views/explore/releases/detail';
import {getReleaseParams} from 'sentry/views/explore/releases/utils';
import {
  getSdkVersionKey,
  mergeSdkVersionRows,
  releaseSdkVersionsApiOptions,
  selectSdkVersionRows,
} from 'sentry/views/explore/releases/utils/releaseSdkVersionsApiOptions';

type Props = {
  organization: Organization;
  version: string;
};

export function SdkVersions({organization, version}: Props) {
  const location = useLocation();
  const {releaseBounds} = useContext(ReleaseContext);

  const result = useInfiniteQuery({
    ...releaseSdkVersionsApiOptions({
      organization,
      pageFilterParams: getReleaseParams({location, releaseBounds}),
      referrer: 'api.releases.release-details-sdk-versions',
      versions: [version],
    }),
    select: data => mergeSdkVersionRows(selectSdkVersionRows(data)),
  });
  useFetchAllPages({result});
  const {data: sdkVersions, isPending, isError} = result;

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError />;
  }

  if (!sdkVersions.length) {
    return null;
  }

  const total = sdkVersions.reduce((sum, sdk) => sum + sdk.count, 0);

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
            {sdkVersions.map(sdk => (
              <Flex key={getSdkVersionKey(sdk)} justify="between" gap="md">
                <Flex gap="md" minWidth="0">
                  <Text ellipsis>{sdk.name}</Text>
                  <Text variant="muted" wrap="nowrap">
                    {sdk.version}
                  </Text>
                </Flex>
                <Text>
                  {formatPercentage(sdk.count / total, 0, {minimumValue: 0.01})}
                </Text>
              </Flex>
            ))}
          </Collapsible>
        </Stack>
      </SidebarSection.Content>
    </SidebarSection.Wrap>
  );
}
