import {useState} from 'react';
import {useMutation, useQuery} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {InputGroup} from '@sentry/scraps/input';
import {Stack} from '@sentry/scraps/layout';
import {Pagination} from '@sentry/scraps/pagination';
import {Heading} from '@sentry/scraps/text';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {parseApiError} from 'sentry/utils/parseApiError';
import {parseLinkHeader} from 'sentry/utils/parseLinkHeader';
import {decodeScalar} from 'sentry/utils/queryString';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useLocationQuery} from 'sentry/utils/url/useLocationQuery';
import {useApi} from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  BuildDetailsState,
  type BuildDetailsApiResponse,
} from 'sentry/views/preprod/types/buildDetailsTypes';
import {buildDetailsApiOptions} from 'sentry/views/preprod/utils/buildDetailsApiOptions';
import {
  getCompareApiUrl,
  getCompareBuildPath,
} from 'sentry/views/preprod/utils/buildLinkUtils';

import {BuildItem} from './buildItem';
import {ExistingComparisons} from './existingComparisons';
import {SizeCompareSelectedBuilds} from './sizeCompareSelectedBuilds';

interface SizeCompareSelectionContentProps {
  headBuildDetails: BuildDetailsApiResponse;
  baseBuildDetails?: BuildDetailsApiResponse;
}

export function SizeCompareSelectionContent({
  headBuildDetails,
  baseBuildDetails,
}: SizeCompareSelectionContentProps) {
  const organization = useOrganization();
  const api = useApi({persistInFlight: true});
  const navigate = useNavigate();
  const {cursor} = useLocationQuery({
    fields: {
      cursor: decodeScalar,
    },
  });
  const [selectedBaseBuild, setSelectedBaseBuild] = useState(baseBuildDetails);
  const [searchQuery, setSearchQuery] = useState('');

  const searchFilters: string[] = [`state:${BuildDetailsState.PROCESSED}`];
  if (headBuildDetails.app_info?.app_id) {
    searchFilters.push(`app_id:"${headBuildDetails.app_info.app_id}"`);
  }
  if (headBuildDetails.app_info?.build_configuration) {
    searchFilters.push(
      `build_configuration_name:"${headBuildDetails.app_info.build_configuration}"`
    );
  }
  if (searchQuery) {
    searchFilters.push(searchQuery);
  }
  const fullQuery = searchFilters.join(' ');

  const buildsQuery = useQuery({
    ...buildDetailsApiOptions({
      organization,
      queryParams: {
        per_page: 25,
        project: headBuildDetails.project_id,
        query: fullQuery,
        ...(cursor && {cursor}),
      },
    }),
    select: selectJsonWithHeaders,
  });

  const pageLinks = buildsQuery.data?.headers.Link || null;

  const parsedLinks = pageLinks ? parseLinkHeader(pageLinks) : {};
  const hasPagination =
    parsedLinks.previous?.results === true || parsedLinks.next?.results === true;

  const {mutate: triggerComparison, isPending: isComparing} = useMutation<
    void,
    RequestError,
    {baseArtifactId: string; headArtifactId: string}
  >({
    mutationFn: ({headArtifactId, baseArtifactId}) => {
      return api.requestPromise(
        getCompareApiUrl({
          organizationSlug: organization.slug,
          headArtifactId,
          baseArtifactId,
        }),
        {method: 'POST'}
      );
    },
    onSuccess: () => {
      navigate(
        getCompareBuildPath({
          organizationSlug: organization.slug,
          headArtifactId: headBuildDetails.id,
          baseArtifactId: selectedBaseBuild?.id,
        })
      );
    },
    onError: error => {
      const errorMessage = parseApiError(error);
      addErrorMessage(
        errorMessage === 'Unknown API Error'
          ? t('Failed to trigger comparison. Please try again.')
          : errorMessage
      );
    },
  });

  return (
    <Stack gap="2xl">
      <SizeCompareSelectedBuilds
        isComparing={isComparing}
        headBuildDetails={headBuildDetails}
        baseBuildDetails={selectedBaseBuild}
        onClearBaseBuild={() => setSelectedBaseBuild(undefined)}
        onTriggerComparison={() => {
          if (!selectedBaseBuild) {
            addErrorMessage(t('Please select a base build to compare.'));
            return;
          }

          triggerComparison({
            baseArtifactId: selectedBaseBuild.id.toString(),
            headArtifactId: headBuildDetails.id.toString(),
          });
        }}
      />

      <InputGroup>
        <InputGroup.LeadingItems disablePointerEvents>
          <IconSearch />
        </InputGroup.LeadingItems>
        <InputGroup.Input
          placeholder={t('Search builds')}
          value={searchQuery}
          onChange={e => {
            setSearchQuery(e.target.value);
            // Clear the picker's cursor when the search changes to avoid
            // landing on a now-empty page.
            if (cursor) {
              navigate(
                getCompareBuildPath({
                  organizationSlug: organization.slug,
                  headArtifactId: headBuildDetails.id,
                }),
                {replace: true}
              );
            }
          }}
        />
      </InputGroup>

      <ExistingComparisons
        headBuildDetails={headBuildDetails}
        searchQuery={searchQuery}
      />

      <Stack gap="lg">
        <Heading as="h2">{t('Create New Comparison')}</Heading>

        {buildsQuery.isLoading && <LoadingIndicator />}
        {buildsQuery.isError && (
          <Alert variant="danger">{buildsQuery.error?.message}</Alert>
        )}
        {buildsQuery.data?.json && (
          <Stack gap="md">
            {buildsQuery.data.json.map(build => {
              if (build.id === headBuildDetails.id) {
                return null;
              }

              return (
                <BuildItem
                  key={build.id}
                  build={build}
                  isSelected={selectedBaseBuild === build}
                  onSelect={() => {
                    setSelectedBaseBuild(build);
                    trackAnalytics('preprod.builds.compare.select_base_build', {
                      organization,
                      build_id: build.id,
                      platform:
                        build.app_info?.platform ??
                        headBuildDetails.app_info?.platform ??
                        null,
                    });
                  }}
                />
              );
            })}

            {hasPagination && <Pagination pageLinks={pageLinks} />}
          </Stack>
        )}
      </Stack>
    </Stack>
  );
}
