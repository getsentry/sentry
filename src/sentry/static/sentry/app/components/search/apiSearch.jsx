import {withRouter} from 'react-router';
import PropTypes from 'prop-types';
import Raven from 'raven-js';
import React from 'react';
import {flatten, debounce} from 'lodash';

import {Client} from '../../api';

class ApiSearch extends React.Component {
  static propTypes = {
    query: PropTypes.string,
    /**
     * Render function that passes:
     * `isLoading` - loading state
     * `allResults` - All results returned from all queries: [searchIndex, model, type]
     * `results` - Results array filtered by `this.props.query`: [searchIndex, model, type]
     */
    children: PropTypes.func.isRequired,
  };

  constructor(props, ...args) {
    super(props, ...args);
    this.state = {
      loading: false,
      allResults: null,
      results: null,
    };

    this.api = new Client();

    if (props.query) this.doSearch(props.query);
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.query !== this.props.query) {
      this.setState({loading: true});
      this.doSearch(nextProps.query);
    }
  }

  doSearch = debounce(async query => {
    let {params} = this.props;
    let {orgId} = params;
    let urls = [
      '/organizations/',
      `/organizations/${orgId}/projects/`,
      `/organizations/${orgId}/teams/`,
      `/organizations/${orgId}/members/`,
    ];

    let reqs = urls.map(url =>
      this.api
        .requestPromise(url, {
          query: {
            query,
          },
        })
        .then(
          resp => resp,
          err => {
            Raven.captureException(err);
            return [];
          }
        )
    );

    let [organizations, projects, teams, members] = await Promise.all(reqs);

    let allResults = [
      ...flatten(
        organizations.map(org => [
          {
            searchIndex: org.slug,
            model: org,
            sourceType: 'organization',
            resultType: 'settings',
            to: `/settings/${org.slug}/`,
          },
          {
            searchIndex: `${org.slug} Dashboard`,
            model: org,
            sourceType: 'organization',
            resultType: 'route',
            to: `/${org.slug}/`,
          },
        ])
      ),
      ...flatten(
        projects.map(project => [
          {
            searchIndex: project.slug,
            model: project,
            sourceType: 'project',
            resultType: 'settings',
            to: `/settings/${orgId}/${project.slug}/`,
          },
          {
            searchIndex: `${project.slug} Dashboard`,
            model: project,
            sourceType: 'project',
            resultType: 'route',
            to: `/${orgId}/${project.slug}/`,
          },
        ])
      ),
      ...teams.map(team => ({
        searchIndex: team.slug,
        model: team,
        sourceType: 'team',
        resultType: 'settings',
        to: `/settings/${orgId}/teams/${team.slug}/`,
      })),
      ...members.map(member => ({
        searchIndex: `${member.email}${member.name}`,
        model: member,
        sourceType: 'member',
        resultType: 'settings',
        to: `/settings/${orgId}/member/${member.slug}/`,
      })),
    ];

    let results = allResults.filter(({searchIndex}) => searchIndex.indexOf(query) > -1);

    this.setState({
      loading: false,
      allResults,
      results,
    });
  }, 150);

  render() {
    let {children} = this.props;

    return children({
      isLoading: this.state.loading,
      allResults: this.state.allResults,
      results: this.state.results,
    });
  }
}

export {ApiSearch};
export default withRouter(ApiSearch);
