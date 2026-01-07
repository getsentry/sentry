import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {ExternalLink, Link} from 'sentry/components/core/link';
import Count from 'sentry/components/count';
import {DeviceName} from 'sentry/components/deviceName';
import {TAGS_DOCS_LINK} from 'sentry/components/events/eventTags/util';
import GlobalSelectionLink from 'sentry/components/globalSelectionLink';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {extractSelectionParameters} from 'sentry/components/organizations/pageFilters/utils';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import Version from 'sentry/components/version';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {generateQueryWithTag, percent} from 'sentry/utils';
import {useLocation} from 'sentry/utils/useLocation';
import {useParams} from 'sentry/utils/useParams';
import GroupEventDetails from 'sentry/views/issueDetails/groupEventDetails/groupEventDetails';
import {useGroupTags} from 'sentry/views/issueDetails/groupTags/useGroupTags';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';
import {useGroup} from 'sentry/views/issueDetails/useGroup';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';
import {
  useEnvironmentsFromUrl,
  useHasStreamlinedUI,
} from 'sentry/views/issueDetails/utils';

type SimpleTag = {
  key: string;
  topValues: Array<{
    count: number;
    name: string;
    value: string;
    query?: string;
  }>;
  totalValues: number;
};

export function GroupTagsTab() {
  const location = useLocation();
  const environments = useEnvironmentsFromUrl();
  const {baseUrl} = useGroupDetailsRoute();
  const params = useParams<{groupId: string}>();

  const {
    data: group,
    isPending: isGroupPending,
    isError: isGroupError,
    refetch: refetchGroup,
  } = useGroup({groupId: params.groupId});

  const {data, isPending, isError, refetch} = useGroupTags({
    groupId: group?.id,
    environment: environments,
    limit: 10,
  });

  if (isPending || isGroupPending) {
    return <LoadingIndicator />;
  }

  if (isError || isGroupError) {
    return (
      <LoadingError
        message={t('There was an error loading issue tags.')}
        onRetry={() => {
          refetch();
          refetchGroup();
        }}
      />
    );
  }

  const getTagKeyTarget = (tag: SimpleTag) => {
    return {
      pathname: `${baseUrl}${TabPaths[Tab.DISTRIBUTIONS]}${tag.key}/`,
      query: extractSelectionParameters(location.query),
    };
  };

  const alphabeticalTags = data.toSorted((a, b) => a.key.localeCompare(b.key));
  return (
    <Layout.Body>
      <Layout.Main width="full">
        <Alert.Container>
          <Alert variant="info" showIcon={false}>
            {tct(
              'Tags are automatically indexed for searching and breakdown charts. Learn how to [link: add custom tags to issues]',
              {
                link: <ExternalLink href={TAGS_DOCS_LINK} />,
              }
            )}
          </Alert>
        </Alert.Container>
        <Container>
          {alphabeticalTags.map((tag, tagIdx) => (
            <TagItem key={tagIdx}>
              <StyledPanel>
                <PanelBody withPadding>
                  <TagHeading>
                    <Link to={getTagKeyTarget(tag)}>
                      <span data-test-id="tag-title">{tag.key}</span>
                    </Link>
                  </TagHeading>
                  <UnstyledUnorderedList>
                    {tag.topValues.map((tagValue, tagValueIdx) => {
                      const tagName = tagValue.name === '' ? t('(empty)') : tagValue.name;
                      const query = tagValue.query
                        ? {
                            ...location.query,
                            query: tagValue.query,
                          }
                        : generateQueryWithTag(location.query, {
                            key: tag.key,
                            value: tagValue.value,
                          });
                      return (
                        <li key={tagValueIdx} data-test-id={tag.key}>
                          <TagBarGlobalSelectionLink
                            to={{
                              pathname: `${baseUrl}events/`,
                              query,
                            }}
                          >
                            <TagBarBackground
                              widthPercent={
                                percent(tagValue.count, tag.totalValues) + '%'
                              }
                            />
                            <TagBarLabel>
                              {tag.key === 'release' ? (
                                <Version version={tagName} anchor={false} />
                              ) : (
                                <DeviceName value={tagName} />
                              )}
                            </TagBarLabel>
                            <TagBarCount>
                              <Count value={tagValue.count} />
                            </TagBarCount>
                          </TagBarGlobalSelectionLink>
                        </li>
                      );
                    })}
                  </UnstyledUnorderedList>
                </PanelBody>
              </StyledPanel>
            </TagItem>
          ))}
        </Container>
      </Layout.Main>
    </Layout.Body>
  );
}

function GroupTagsRoute() {
  const hasStreamlinedUI = useHasStreamlinedUI();

  // TODO(streamlined-ui): Point the router to group event details
  if (hasStreamlinedUI) {
    return <GroupEventDetails />;
  }

  return <GroupTagsTab />;
}

export default GroupTagsRoute;

const Container = styled('div')`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: ${space(2)};
  margin-bottom: ${space(2)};
`;

const StyledPanel = styled(Panel)`
  height: 100%;
`;

const TagHeading = styled('h5')`
  font-size: ${p => p.theme.fontSize.lg};
  margin-bottom: 0;
  color: ${p => p.theme.tokens.interactive.link.accent.rest};
`;

const UnstyledUnorderedList = styled('ul')`
  list-style: none;
  padding-left: 0;
  margin-bottom: 0;
`;

const TagItem = styled('div')`
  padding: 0;
`;

const TagBarBackground = styled('div')<{widthPercent: string}>`
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  background: ${p => p.theme.colors.surface200};
  border-radius: ${p => p.theme.radius.md};
  width: ${p => p.widthPercent};
`;

const TagBarGlobalSelectionLink = styled(GlobalSelectionLink)`
  position: relative;
  display: flex;
  line-height: 2.2;
  color: ${p => p.theme.tokens.content.primary};
  margin-bottom: ${space(0.5)};
  padding: 0 ${space(1)};
  background: ${p => p.theme.backgroundSecondary};
  border-radius: ${p => p.theme.radius.md};
  overflow: hidden;

  &:hover {
    color: ${p => p.theme.tokens.content.primary};
    text-decoration: underline;
    ${TagBarBackground} {
      background: ${p => p.theme.colors.blue400};
    }
  }
`;

const TagBarLabel = styled('div')`
  display: flex;
  align-items: center;
  font-size: ${p => p.theme.fontSize.md};
  position: relative;
  flex-grow: 1;
  ${p => p.theme.overflowEllipsis}
`;

const TagBarCount = styled('div')`
  font-size: ${p => p.theme.fontSize.md};
  position: relative;
  padding-left: ${space(2)};
  padding-right: ${space(1)};
  font-variant-numeric: tabular-nums;
`;
