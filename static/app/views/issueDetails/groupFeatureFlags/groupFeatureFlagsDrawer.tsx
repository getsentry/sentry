import {useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import ButtonBar from 'sentry/components/buttonBar';
import {InputGroup} from 'sentry/components/core/input/inputGroup';
import {
  CrumbContainer,
  EventDrawerBody,
  EventDrawerContainer,
  EventDrawerHeader,
  EventNavigator,
  NavigationCrumbs,
  SearchInput,
  ShortId,
} from 'sentry/components/events/eventDrawer';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import useProjects from 'sentry/utils/useProjects';
import TagsAndFlagsSegmentedControl from 'sentry/views/issueDetails/groupFeatureFlags/tagsAndFlagsSegmentedControl';
import useGroupFeatureFlags from 'sentry/views/issueDetails/groupFeatureFlags/useGroupFeatureFlags';
import {TagDistribution} from 'sentry/views/issueDetails/groupTags/tagDistribution';
import type {GroupTag} from 'sentry/views/issueDetails/groupTags/useGroupTags';
import {useEnvironmentsFromUrl} from 'sentry/views/issueDetails/utils';

/**
 * Ordering for tags in the drawer.
 */
function getSortedTags(tags: GroupTag[]) {
  // Alphabetical by key.
  return tags.toSorted((t1, t2) => t1.key.localeCompare(t2.key));
}

export default function GroupFeatureFlagsDrawer({
  group,
  includeTagsTab,
}: {
  group: Group;
  includeTagsTab: boolean;
}) {
  const environments = useEnvironmentsFromUrl();
  const {projects} = useProjects();
  const project = projects.find(p => p.slug === group.project.slug)!;

  const drawerRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState('');

  // Flags use the same endpoint and response format as tags, so we reuse TagDistribution, tag types, and "tag" in variable names.
  const {
    data = [],
    isPending,
    isError,
    refetch,
  } = useGroupFeatureFlags({
    groupId: group.id,
    environment: environments,
  });

  const tagValues = useMemo(
    () =>
      data.reduce<Record<string, string>>((valueMap, tag) => {
        valueMap[tag.key] = tag.topValues.map(tv => tv.value).join(' ');
        return valueMap;
      }, {}),
    [data]
  );

  const displayTags = useMemo(() => {
    const sortedTags = getSortedTags(data);
    const searchedTags = sortedTags.filter(
      tag =>
        tag.key.includes(search) ||
        tag.name.includes(search) ||
        tagValues[tag.key]?.toLowerCase().includes(search.toLowerCase())
    );
    return searchedTags;
  }, [data, search, tagValues]);

  const headerActions = (
    <ButtonBar gap={1}>
      <InputGroup>
        <SearchInput
          size="xs"
          value={search}
          onChange={e => {
            setSearch(e.target.value);
          }}
          aria-label={t('Search All Feature Flags')}
        />
        <InputGroup.TrailingItems disablePointerEvents>
          <IconSearch size="xs" />
        </InputGroup.TrailingItems>
      </InputGroup>
      {includeTagsTab && <TagsAndFlagsSegmentedControl tab="featureFlags" />}
    </ButtonBar>
  );

  return (
    <EventDrawerContainer ref={drawerRef}>
      <EventDrawerHeader>
        <NavigationCrumbs
          crumbs={[
            {
              label: (
                <CrumbContainer>
                  <ProjectAvatar project={project} />
                  <ShortId>{group.shortId}</ShortId>
                </CrumbContainer>
              ),
            },
            {
              label: t('All Feature Flags'),
            },
          ]}
        />
      </EventDrawerHeader>
      <EventNavigator>
        <Header>{t('Tags & Feature Flags')}</Header>
        {headerActions}
      </EventNavigator>
      <EventDrawerBody>
        {isPending ? (
          <LoadingIndicator />
        ) : isError ? (
          <LoadingError
            message={t('There was an error loading feature flags.')}
            onRetry={refetch}
          />
        ) : (
          <Wrapper>
            <Container>
              {displayTags.map((tag, tagIdx) => (
                <TagDistribution tag={tag} key={tagIdx} />
              ))}
            </Container>
          </Wrapper>
        )}
      </EventDrawerBody>
    </EventDrawerContainer>
  );
}

const Wrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;

const Container = styled('div')`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: ${space(2)};
  margin-bottom: ${space(2)};
`;

const Header = styled('h3')`
  ${p => p.theme.overflowEllipsis};
  font-size: ${p => p.theme.fontSizeExtraLarge};
  font-weight: ${p => p.theme.fontWeightBold};
  margin: 0;
`;
