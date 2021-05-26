import * as React from 'react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import {Client} from 'app/api';
import Alert from 'app/components/alert';
import Count from 'app/components/count';
import DeviceName from 'app/components/deviceName';
import GlobalSelectionLink from 'app/components/globalSelectionLink';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import Version from 'app/components/version';
import {t, tct} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {Group, TagWithTopValues} from 'app/types';
import {percent} from 'app/utils';
import withApi from 'app/utils/withApi';

type Props = {
  baseUrl: string;
  group: Group;
  api: Client;
  environments: string[];
};

type State = {
  tagList: null | TagWithTopValues[];
  loading: boolean;
  error: boolean;
};

class GroupTags extends React.Component<Props, State> {
  state: State = {
    tagList: null,
    loading: true,
    error: false,
  };

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps: Props) {
    if (!isEqual(prevProps.environments, this.props.environments)) {
      this.fetchData();
    }
  }

  fetchData = () => {
    const {api, group, environments} = this.props;
    this.setState({
      loading: true,
      error: false,
    });

    api.request(`/issues/${group.id}/tags/`, {
      query: {environment: environments},
      success: data => {
        this.setState({
          tagList: data,
          error: false,
          loading: false,
        });
      },
      error: () => {
        this.setState({
          error: true,
          loading: false,
        });
      },
    });
  };

  getTagsDocsUrl() {
    return 'https://docs.sentry.io/platform-redirect/?next=/enriching-events/tags';
  }

  render() {
    const {baseUrl} = this.props;

    let children: React.ReactNode[] = [];

    if (this.state.loading) {
      return <LoadingIndicator />;
    } else if (this.state.error) {
      return <LoadingError onRetry={this.fetchData} />;
    }

    if (this.state.tagList) {
      children = this.state.tagList.map((tag, tagIdx) => {
        const valueChildren = tag.topValues.map((tagValue, tagValueIdx) => {
          let label: React.ReactNode = null;
          const pct = percent(tagValue.count, tag.totalValues);
          const query = tagValue.query || `${tag.key}:"${tagValue.value}"`;

          switch (tag.key) {
            case 'release':
              label = <Version version={tagValue.name} anchor={false} />;
              break;
            default:
              label = <DeviceName value={tagValue.name} />;
          }

          return (
            <li key={tagValueIdx} data-test-id={tag.key}>
              <TagBarGlobalSelectionLink
                to={{
                  pathname: `${baseUrl}events/`,
                  query: {query},
                }}
              >
                <TagBarBackground style={{width: pct + '%'}} />
                <TagBarLabel>{label}</TagBarLabel>
                <TagBarCount>
                  <Count value={tagValue.count} />
                </TagBarCount>
              </TagBarGlobalSelectionLink>
            </li>
          );
        });

        return (
          <TagItem key={tagIdx}>
            <Panel>
              <PanelHeader hasButtons style={{textTransform: 'none'}}>
                <div style={{fontSize: 16}}>{tag.key}</div>
                <DetailsLinkWrapper>
                  <GlobalSelectionLink
                    className="btn btn-default btn-sm"
                    to={`${baseUrl}tags/${tag.key}/`}
                  >
                    {t('More Details')}
                  </GlobalSelectionLink>
                </DetailsLinkWrapper>
              </PanelHeader>
              <PanelBody withPadding>
                <ul style={{listStyleType: 'none', padding: 0, margin: 0}}>
                  {valueChildren}
                </ul>
              </PanelBody>
            </Panel>
          </TagItem>
        );
      });
    }

    return (
      <div>
        <Container>{children}</Container>
        <Alert type="info">
          {tct(
            'Tags are automatically indexed for searching and breakdown charts. Learn how to [link: add custom tags to issues]',
            {
              link: <a href={this.getTagsDocsUrl()} />,
            }
          )}
        </Alert>
      </div>
    );
  }
}

const DetailsLinkWrapper = styled('div')`
  display: flex;
`;

const Container = styled('div')`
  display: flex;
  flex-wrap: wrap;
`;

const TagItem = styled('div')`
  padding: 0 ${space(1)};
  width: 50%;
`;

const TagBarBackground = styled('div')`
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  background: ${p => p.theme.tagBar};
  border-radius: ${p => p.theme.borderRadius};
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
`;

export default withApi(GroupTags);
