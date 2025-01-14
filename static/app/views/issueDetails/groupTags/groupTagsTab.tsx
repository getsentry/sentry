import styled from '@emotion/styled';

import {Alert} from 'sentry/components/alert';
import Count from 'sentry/components/count';
import {DeviceName} from 'sentry/components/deviceName';
import {TAGS_DOCS_LINK} from 'sentry/components/events/eventTags/util';
import GlobalSelectionLink from 'sentry/components/globalSelectionLink';
import * as Layout from 'sentry/components/layouts/thirds';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {extractSelectionParameters} from 'sentry/components/organizations/pageFilters/utils';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import Version from 'sentry/components/version';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {percent} from 'sentry/utils';
import {useLocation} from 'sentry/utils/useLocation';
import {useParams} from 'sentry/utils/useParams';
import GroupEventDetails from 'sentry/views/issueDetails/groupEventDetails/groupEventDetails';
import {useGroupTags} from 'sentry/views/issueDetails/groupTags/useGroupTags';
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

  const {
    data = [],
    isPending,
    isError,
    refetch,
  } = useGroupTags({
    groupId: group?.id,
    environment: environments,
  });

  const alphabeticalTags = data.sort((a, b) => a.key.localeCompare(b.key));

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
      pathname: `${baseUrl}tags/${tag.key}/`,
      query: extractSelectionParameters(location.query),
    };
  };

  return (
    <Layout.Body>
      <Layout.Main fullWidth>
        <Alert type="info">
          {tct(
            'Tags are automatically indexed for searching and breakdown charts. Learn how to [link: add custom tags to issues]',
            {
              link: <ExternalLink href={TAGS_DOCS_LINK} />,
            }
          )}
        </Alert>
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
                    {tag.topValues.map((tagValue, tagValueIdx) => (
                      <li key={tagValueIdx} data-test-id={tag.key}>
                        <TagBarGlobalSelectionLink
                          to={{
                            pathname: `${baseUrl}events/`,
                            query: {
                              query: tagValue.query || `${tag.key}:"${tagValue.value}"`,
                            },
                          }}
                        >
                          <TagBarBackground
                            widthPercent={percent(tagValue.count, tag.totalValues) + '%'}
                          />
                          <TagBarLabel>
                            {tag.key === 'release' ? (
                              <Version version={tagValue.name} anchor={false} />
                            ) : (
                              <DeviceName value={tagValue.name} />
                            )}
                          </TagBarLabel>
                          <TagBarCount>
                            <Count value={tagValue.count} />
                          </TagBarCount>
                        </TagBarGlobalSelectionLink>
                      </li>
                    ))}
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
  font-size: ${p => p.theme.fontSizeLarge};
  margin-bottom: 0;
  color: ${p => p.theme.linkColor};
`;

const TagItem = styled('div')`
  padding: 0;
`;
const UnstyledUnorderedList = styled('ul')`
  list-style: none;
  padding-left: 0;
  margin-bottom: 0;
`;

const TagBarBackground = styled('div')<{widthPercent: string}>`
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  background: ${p => p.theme.tagBar};
  border-radius: ${p => p.theme.borderRadius};
  width: ${p => p.widthPercent};
`;

const TagBarGlobalSelectionLink = styled(GlobalSelectionLink)`
  position: relative;
  display: flex;
  line-height: 2.2;
  color: ${p => p.theme.textColor};
  margin-bottom: ${space(0.5)};
  padding: 0 ${space(1)};
  background: ${p => p.theme.backgroundSecondary};
  border-radius: ${p => p.theme.borderRadius};
  overflow: hidden;

  &:hover {
    color: ${p => p.theme.textColor};
    text-decoration: underline;
    ${TagBarBackground} {
      background: ${p => p.theme.tagBarHover};
    }
  }
`;

const TagBarLabel = styled('div')`
  display: flex;
  align-items: center;
  font-size: ${p => p.theme.fontSizeMedium};
  position: relative;
  flex-grow: 1;
  ${p => p.theme.overflowEllipsis}
`;

const TagBarCount = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  position: relative;
  padding-left: ${space(2)};
  padding-right: ${space(1)};
  font-variant-numeric: tabular-nums;
`;
