import {useCallback} from 'react';

// eslint-disable-next-line no-restricted-imports
import {fetchTagValues} from 'sentry/actionCreators/tags';
import SmartSearchBar from 'sentry/components/smartSearchBar';
import {Organization, SavedSearchType, Tag, TagCollection} from 'sentry/types';
import {getUtcDateString} from 'sentry/utils/dates';
import {
  DEVICE_CLASS_TAG_VALUES,
  FieldKind,
  getFieldDefinition,
  isDeviceClass,
} from 'sentry/utils/fields';
import useApi from 'sentry/utils/useApi';
import usePageFilters from 'sentry/utils/usePageFilters';
import withIssueTags, {WithIssueTagsProps} from 'sentry/utils/withIssueTags';

const getSupportedTags = (supportedTags: TagCollection) =>
  Object.fromEntries(
    Object.keys(supportedTags).map(key => [
      key,
      {
        ...supportedTags[key],
        kind:
          getFieldDefinition(key)?.kind ??
          (supportedTags[key].predefined ? FieldKind.FIELD : FieldKind.TAG),
      },
    ])
  );

interface Props extends React.ComponentProps<typeof SmartSearchBar>, WithIssueTagsProps {
  organization: Organization;
}

const EXCLUDED_TAGS = ['environment'];

const IssueListSearchBar = ({organization, tags, ...props}: Props) => {
  const api = useApi();
  const {selection: pageFilters} = usePageFilters();

  const tagValueLoader = useCallback(
    (key: string, search: string) => {
      const orgSlug = organization.slug;
      const projectIds = pageFilters.projects.map(id => id.toString());
      const endpointParams = {
        start: getUtcDateString(pageFilters.datetime.start),
        end: getUtcDateString(pageFilters.datetime.end),
        statsPeriod: pageFilters.datetime.period,
      };

      return fetchTagValues({
        api,
        orgSlug,
        tagKey: key,
        search,
        projectIds,
        endpointParams,
      });
    },
    [
      api,
      organization.slug,
      pageFilters.datetime.end,
      pageFilters.datetime.period,
      pageFilters.datetime.start,
      pageFilters.projects,
    ]
  );

  const getTagValues = useCallback(
    async (tag: Tag, query: string): Promise<string[]> => {
      // device.class is stored as "numbers" in snuba, but we want to suggest high, medium,
      // and low search filter values because discover maps device.class to these values.
      if (isDeviceClass(tag.key)) {
        return DEVICE_CLASS_TAG_VALUES;
      }
      const values = await tagValueLoader(tag.key, query);
      return values.map(({value}) => value);
    },
    [tagValueLoader]
  );

  return (
    <SmartSearchBar
      hasRecentSearches
      savedSearchType={SavedSearchType.ISSUE}
      onGetTagValues={getTagValues}
      excludedTags={EXCLUDED_TAGS}
      maxMenuHeight={500}
      supportedTags={getSupportedTags(tags)}
      organization={organization}
      {...props}
    />
  );
};

export default withIssueTags(IssueListSearchBar);
