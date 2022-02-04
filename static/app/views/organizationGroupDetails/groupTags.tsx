import * as React from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import Alert from 'sentry/components/alert';
import AsyncComponent from 'sentry/components/asyncComponent';
import Button from 'sentry/components/button';
import Count from 'sentry/components/count';
import {DeviceName} from 'sentry/components/deviceName';
import GlobalSelectionLink from 'sentry/components/globalSelectionLink';
import ExternalLink from 'sentry/components/links/externalLink';
import {extractSelectionParameters} from 'sentry/components/organizations/pageFilters/utils';
import {Panel, PanelBody, PanelHeader} from 'sentry/components/panels';
import Version from 'sentry/components/version';
import {t, tct} from 'sentry/locale';
import overflowEllipsis from 'sentry/styles/overflowEllipsis';
import space from 'sentry/styles/space';
import {Group, TagWithTopValues} from 'sentry/types';
import {percent} from 'sentry/utils';

type Props = AsyncComponent['props'] & {
  baseUrl: string;
  group: Group;
  environments: string[];
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
            <Panel>
              <StyledPanelHeader hasButtons>
                <TagHeading>{tag.key}</TagHeading>
                <Button
                  size="small"
                  to={{
                    pathname: `${baseUrl}tags/${tag.key}/`,
                    query: extractSelectionParameters(location.query),
                  }}
                >
                  {t('More Details')}
                </Button>
              </StyledPanelHeader>
              <PanelBody withPadding>
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
            </Panel>
          </TagItem>
        ))}
      </Container>
    );
  }

  renderBody() {
    return (
      <div>
        {this.renderTags()}
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
      </div>
    );
  }
}

const Container = styled('div')`
  display: flex;
  flex-wrap: wrap;
`;

const StyledPanelHeader = styled(PanelHeader)`
  text-transform: none;
`;

const TagHeading = styled('h5')`
  font-size: ${p => p.theme.fontSizeLarge};
  margin-bottom: 0;
`;

const UnstyledUnorderedList = styled('ul')`
  list-style: none;
  padding-left: 0;
  margin-bottom: 0;
`;

const TagItem = styled('div')`
  padding: 0 ${space(1)};
  width: 50%;
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
  position: relative;
  flex-grow: 1;
  ${overflowEllipsis}
`;

const TagBarCount = styled('div')`
  position: relative;
  padding-left: ${space(2)};
  font-variant-numeric: tabular-nums;
`;

export default GroupTags;
