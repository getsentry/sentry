import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import Alert from 'sentry/components/alert';
import AsyncComponent from 'sentry/components/asyncComponent';
import Count from 'sentry/components/count';
import {DeviceName} from 'sentry/components/deviceName';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import GlobalSelectionLink from 'sentry/components/globalSelectionLink';
import * as Layout from 'sentry/components/layouts/thirds';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import {extractSelectionParameters} from 'sentry/components/organizations/pageFilters/utils';
import {Panel, PanelBody} from 'sentry/components/panels';
import Version from 'sentry/components/version';
import {tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Group, Organization, TagWithTopValues} from 'sentry/types';
import {percent} from 'sentry/utils';
import withOrganization from 'sentry/utils/withOrganization';

type Props = AsyncComponent['props'] & {
  baseUrl: string;
  environments: string[];
  group: Group;
  organization: Organization;
} & RouteComponentProps<{}, {}>;

type State = AsyncComponent['state'] & {
  tagList: null | TagWithTopValues[];
};

class GroupTags extends AsyncComponent<Props, State> {
  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      tagList: null,
    };
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {group, environments} = this.props;
    return [
      [
        'tagList',
        `/issues/${group.id}/tags/`,
        {
          query: {environment: environments},
        },
      ],
    ];
  }

  componentDidUpdate(prevProps: Props) {
    if (!isEqual(prevProps.environments, this.props.environments)) {
      this.remountComponent();
    }
  }

  renderTags() {
    const {baseUrl, location} = this.props;
    const {tagList} = this.state;

    const alphabeticalTags = (tagList ?? []).sort((a, b) => a.key.localeCompare(b.key));

    return (
      <Container>
        {alphabeticalTags.map((tag, tagIdx) => (
          <TagItem key={tagIdx}>
            <StyledPanel>
              <PanelBody withPadding>
                <TagHeading>
                  <Link
                    to={{
                      pathname: `${baseUrl}tags/${tag.key}/`,
                      query: extractSelectionParameters(location.query),
                    }}
                  >
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
    );
  }

  renderBody() {
    return (
      <Layout.Body>
        <Layout.Main fullWidth>
          <FilterSection>
            <EnvironmentPageFilter />
          </FilterSection>
          <Alert type="info">
            {tct(
              'Tags are automatically indexed for searching and breakdown charts. Learn how to [link: add custom tags to issues]',
              {
                link: (
                  <ExternalLink href="https://docs.sentry.io/platform-redirect/?next=/enriching-events/tags" />
                ),
              }
            )}
          </Alert>
          {this.renderTags()}
        </Layout.Main>
      </Layout.Body>
    );
  }
}

const Container = styled('div')`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: ${space(2)};
  margin-bottom: ${space(2)};
`;

const FilterSection = styled('div')`
  width: max-content;
  max-width: 100%;
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

export default withOrganization(GroupTags);
