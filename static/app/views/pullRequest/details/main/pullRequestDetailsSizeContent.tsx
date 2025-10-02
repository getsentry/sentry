import {useState} from 'react';
import styled from '@emotion/styled';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Flex, Grid, Stack} from 'sentry/components/core/layout';
import {Heading} from 'sentry/components/core/text';
import {t} from 'sentry/locale';
import {useApiQuery, type UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {BuildDetailsMainContent} from 'sentry/views/preprod/buildDetails/main/buildDetailsMainContent';
import {BuildDetailsSidebarContent} from 'sentry/views/preprod/buildDetails/sidebar/buildDetailsSidebarContent';
import type {AppSizeApiResponse} from 'sentry/views/preprod/types/appSizeTypes';
import type {BuildDetailsApiResponse} from 'sentry/views/preprod/types/buildDetailsTypes';

interface PullRequestDetailsSizeContentProps {
  buildDetails: BuildDetailsApiResponse[];
}

export function PullRequestDetailsSizeContent({
  buildDetails,
}: PullRequestDetailsSizeContentProps) {
  const organization = useOrganization();
  const {projectId} = useParams<{
    projectId: string;
  }>();
  const [selectedBuildId, setSelectedBuildId] = useState<string | undefined>(
    buildDetails[0]?.id
  );

  const appSizeQuery: UseApiQueryResult<AppSizeApiResponse, RequestError> =
    useApiQuery<AppSizeApiResponse>(
      [
        `/projects/${organization.slug}/${projectId}/files/preprodartifacts/${selectedBuildId}/size-analysis/`,
      ],
      {
        staleTime: 0,
        enabled: !!projectId && !!selectedBuildId,
      }
    );

  if (buildDetails.length === 0 || !selectedBuildId) {
    return <div>No build details found</div>;
  }

  const getBuildDetailsLabel = (buildDetail: BuildDetailsApiResponse) => {
    const {id, app_info} = buildDetail;
    let label = `#${id}`;

    if (app_info?.app_id) {
      label += ` ${app_info.app_id}`;
    }
    if (app_info?.version) {
      label += ` v${app_info.version}`;
    }
    if (app_info?.build_number) {
      label += ` (${app_info.build_number})`;
    }
    if (app_info?.build_configuration) {
      label += ` ${app_info.build_configuration}`;
    }
    return label;
  };

  const selectOptions = buildDetails.map(buildDetail => ({
    label: getBuildDetailsLabel(buildDetail),
    value: buildDetail.id.toString(),
    buildDetail,
  }));
  const selectedBuildDetail = buildDetails.find(
    buildDetail => buildDetail.id === selectedBuildId
  );

  return (
    <Stack gap="2xl" padding="md">
      {buildDetails.length > 1 && (
        <Flex align="center" gap="md">
          <Heading as="h2">{t('Builds (%s)', buildDetails.length)}</Heading>
          <SelectContainer>
            <CompactSelect
              size="md"
              value={selectedBuildId}
              onChange={(option: any) => {
                setSelectedBuildId(option?.value);
              }}
              options={selectOptions}
              aria-label={t('Select build')}
            />
          </SelectContainer>
        </Flex>
      )}
      <Grid areas={`"main sidebar"`} columns="1fr 325px" gap="3xl">
        <Flex area="sidebar">
          {buildDetails.length > 0 && (
            <BuildDetailsSidebarContent
              buildDetailsData={selectedBuildDetail}
              artifactId={selectedBuildId}
              projectId={projectId}
            />
          )}
        </Flex>
        <Flex area="main" width="100%" justify="center">
          <BuildDetailsMainContent
            buildDetailsData={selectedBuildDetail}
            appSizeData={appSizeQuery.data}
            isAppSizePending={appSizeQuery.isPending}
            isAppSizeError={appSizeQuery.isError}
            appSizeError={appSizeQuery.error}
          />
        </Flex>
      </Grid>
    </Stack>
  );
}

const SelectContainer = styled('div')`
  flex: 1;
  max-width: 300px;
`;
