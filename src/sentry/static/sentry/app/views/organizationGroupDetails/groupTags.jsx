import {Component} from 'react';
import PropTypes from 'prop-types';
import isEqual from 'lodash/isEqual';
import styled from '@emotion/styled';

import SentryTypes from 'app/sentryTypes';
import Count from 'app/components/count';
import DeviceName from 'app/components/deviceName';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import {percent} from 'app/utils';
import {t, tct} from 'app/locale';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import Alert from 'app/components/alert';
import withApi from 'app/utils/withApi';
import space from 'app/styles/space';
import GlobalSelectionLink from 'app/components/globalSelectionLink';
import Version from 'app/components/version';

class GroupTags extends Component {
  static propTypes = {
    baseUrl: PropTypes.string.isRequired,
    group: SentryTypes.Group.isRequired,
    api: PropTypes.object.isRequired,
    environments: PropTypes.arrayOf(PropTypes.string).isRequired,
  };

  constructor() {
    super();
    this.state = {
      tagList: null,
      loading: true,
      error: false,
    };
  }

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps) {
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
    return 'https://docs.sentry.io/enriching-error-data/additional-data/';
  }

  render() {
    const {baseUrl} = this.props;

    let children = [];

    if (this.state.loading) {
      return <LoadingIndicator />;
    } else if (this.state.error) {
      return <LoadingError onRetry={this.fetchData} />;
    }

    if (this.state.tagList) {
      children = this.state.tagList.map((tag, tagIdx) => {
        const valueChildren = tag.topValues.map((tagValue, tagValueIdx) => {
          let label;
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
              <GlobalSelectionLink
                className="tag-bar"
                to={{
                  pathname: `${baseUrl}events/`,
                  query: {query},
                }}
              >
                <span className="tag-bar-background" style={{width: pct + '%'}} />
                <span className="tag-bar-label">{label}</span>
                <span className="tag-bar-count">
                  <Count value={tagValue.count} />
                </span>
              </GlobalSelectionLink>
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

export default withApi(GroupTags);
