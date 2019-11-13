import React from 'react';
import PropTypes from 'prop-types';
import {Box, Flex} from 'grid-emotion';
import isEqual from 'lodash/isEqual';

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
import withOrganization from 'app/utils/withOrganization';
import GlobalSelectionLink from 'app/components/globalSelectionLink';

class GroupTags extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
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
    return 'https://docs.sentry.io/hosted/learn/context/';
  }

  render() {
    const {group, organization} = this.props;

    let children = [];

    const baseUrl = `/organizations/${organization.slug}/issues/`;

    if (this.state.loading) {
      return <LoadingIndicator />;
    } else if (this.state.error) {
      return <LoadingError onRetry={this.fetchData} />;
    }

    if (this.state.tagList) {
      children = this.state.tagList.map((tag, tagIdx) => {
        const valueChildren = tag.topValues.map((tagValue, tagValueIdx) => {
          const pct = percent(tagValue.count, tag.totalValues);
          const query = tagValue.query || `${tag.key}:"${tagValue.value}"`;
          return (
            <li key={tagValueIdx} data-test-id={tag.key}>
              <GlobalSelectionLink
                className="tag-bar"
                to={{
                  pathname: `${baseUrl}${group.id}/events/`,
                  query: {query},
                }}
              >
                <span className="tag-bar-background" style={{width: pct + '%'}} />
                <span className="tag-bar-label">
                  <DeviceName>{tagValue.name}</DeviceName>
                </span>
                <span className="tag-bar-count">
                  <Count value={tagValue.count} />
                </span>
              </GlobalSelectionLink>
            </li>
          );
        });

        return (
          <Box key={tagIdx} px={1} width={0.5}>
            <Panel>
              <PanelHeader hasButtons style={{textTransform: 'none'}}>
                <div style={{fontSize: 16}}>{tag.key}</div>
                <Flex>
                  <GlobalSelectionLink
                    className="btn btn-default btn-sm"
                    to={`${baseUrl}${group.id}/tags/${tag.key}/`}
                  >
                    {t('More Details')}
                  </GlobalSelectionLink>
                </Flex>
              </PanelHeader>
              <PanelBody disablePadding={false}>
                <ul style={{listStyleType: 'none', padding: 0, margin: 0}}>
                  {valueChildren}
                </ul>
              </PanelBody>
            </Panel>
          </Box>
        );
      });
    }

    return (
      <div>
        <Flex wrap="wrap">{children}</Flex>
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

export default withApi(withOrganization(GroupTags));
