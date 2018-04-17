import React from 'react';
import createReactClass from 'create-react-class';
import {Link} from 'react-router';

import {Box, Flex} from '../components/grid';
import SentryTypes from '../proptypes';
import ApiMixin from '../mixins/apiMixin';
import Count from '../components/count';
import GroupState from '../mixins/groupState';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import {percent, deviceNameMapper} from '../utils';
import {t, tct} from '../locale';
import withEnvironmentInQueryString from '../utils/withEnvironmentInQueryString';
import {Panel, PanelBody, PanelHeader} from '../components/panels';
import Alert from '../components/alert';

const GroupTags = createReactClass({
  displayName: 'GroupTags',

  propTypes: {
    environment: SentryTypes.Environment,
  },

  mixins: [ApiMixin, GroupState],

  getInitialState() {
    return {
      tagList: null,
      loading: true,
      error: false,
      environment: this.props.environment,
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  componentWillReceiveProps(nextProps) {
    if (nextProps.environment !== this.props.environment) {
      this.setState({environment: nextProps.environment}, this.fetchData);
    }
  },

  fetchData() {
    this.setState({
      loading: true,
      error: false,
    });

    const query = {};
    if (this.state.environment) {
      query.environment = this.state.environment.name;
    }

    // TODO(dcramer): each tag should be a separate query as the tags endpoint
    // is not performant
    this.api.request('/issues/' + this.getGroup().id + '/tags/', {
      query,
      success: data => {
        this.setState({
          tagList: data,
          error: false,
          loading: false,
        });
      },
      error: error => {
        this.setState({
          error: true,
          loading: false,
        });
      },
    });
  },

  getTagsDocsUrl() {
    return 'https://docs.sentry.io/hosted/learn/context/';
  },

  render() {
    if (this.state.loading) {
      return <LoadingIndicator />;
    } else if (this.state.error) {
      return <LoadingError onRetry={this.fetchData} />;
    }

    let children = [];

    let orgId = this.getOrganization().slug;
    let projectId = this.getProject().slug;
    let groupId = this.getGroup().id;

    if (this.state.tagList) {
      children = this.state.tagList.map((tag, tagIdx) => {
        let valueChildren = tag.topValues.map((tagValue, tagValueIdx) => {
          let pct = percent(tagValue.count, tag.totalValues);
          return (
            <li key={tagValueIdx}>
              <Link
                className="tag-bar"
                to={{
                  pathname: `/${orgId}/${projectId}/issues/${groupId}/events/`,
                  query: {query: tag.key + ':' + '"' + tagValue.value + '"'},
                }}
              >
                <span className="tag-bar-background" style={{width: pct + '%'}} />
                <span className="tag-bar-label">{deviceNameMapper(tagValue.name)}</span>
                <span className="tag-bar-count">
                  <Count value={tagValue.count} />
                </span>
              </Link>
            </li>
          );
        });

        return (
          <Box key={tagIdx} px={1} width={0.5}>
            <Panel>
              <PanelHeader hasButtons style={{textTransform: 'none'}}>
                <div style={{fontSize: 16}}>{tag.name}</div>
                <Flex>
                  <Link
                    className="btn btn-default btn-sm"
                    to={`/${orgId}/${projectId}/issues/${groupId}/tags/${tag.key}/`}
                  >
                    {t('More Details')}
                  </Link>
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
  },
});

export default withEnvironmentInQueryString(GroupTags);
