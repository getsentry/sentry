import {flatten, debounce} from 'lodash';
import {withRouter} from 'react-router';
import PropTypes from 'prop-types';
import Raven from 'raven-js';
import React from 'react';

import {Client} from 'app/api';
import {createFuzzySearch} from 'app/utils/createFuzzySearch';
import withLatestContext from 'app/utils/withLatestContext';

class ApiSource extends React.Component {
  static propTypes = {
    // search term
    query: PropTypes.string,

    // fuse.js options
    searchOptions: PropTypes.object,

    /**
     * Render function that passes:
     * `isLoading` - loading state
     * `allResults` - All results returned from all queries: [searchIndex, model, type]
     * `results` - Results array filtered by `this.props.query`: [searchIndex, model, type]
     */
    children: PropTypes.func.isRequired,
  };

  static defaultProps = {
    searchOptions: {},
  };

  constructor(props, ...args) {
    super(props, ...args);
    this.state = {
      loading: false,
      allResults: null,
      fuzzy: null,
    };

    this.api = new Client();

    if (typeof props.query !== 'undefined') this.doSearch(props.query);
  }

  componentWillReceiveProps(nextProps) {
    // Limit the number of times we perform API queries by only attempting API queries
    // using first two characters, otherwise perform in-memory search.
    //
    // Otherwise it'd be constant :spinning_loading_wheel:
    if (
      nextProps.query.length <= 2 &&
      nextProps.query.substr(0, 2) !== this.props.query.substr(0, 2)
    ) {
      this.setState({loading: true});
      this.doSearch(nextProps.query);
    }
  }

  doSearch = debounce(async query => {
    let {params, searchOptions, organization} = this.props;
    let orgId = (params && params.orgId) || (organization && organization.slug);
    let urls = ['/organizations/'];

    // Only run these queries when we have an org in context
    if (orgId) {
      urls = [
        ...urls,
        `/organizations/${orgId}/projects/`,
        `/organizations/${orgId}/teams/`,
        `/organizations/${orgId}/members/`,
      ];
    }

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
            title: `${org.slug} Dashboard`,
            description: 'Organization Dashboard',
            model: org,
            sourceType: 'organization',
            resultType: 'route',
            to: `/${org.slug}/`,
          },
          {
            title: `${org.slug} Settings`,
            description: 'Organization Settings',
            model: org,
            sourceType: 'organization',
            resultType: 'settings',
            to: `/settings/${org.slug}/`,
          },
        ])
      ),
      ...flatten(
        (projects || []).map(project => [
          {
            title: `${project.slug} Dashboard`,
            description: 'Project Dashboard',
            model: project,
            sourceType: 'project',
            resultType: 'route',
            to: `/${orgId}/${project.slug}/`,
          },
          {
            title: `${project.slug} Settings`,
            description: 'Project Settings',
            model: project,
            sourceType: 'project',
            resultType: 'settings',
            to: `/settings/${orgId}/${project.slug}/`,
          },
        ])
      ),
      ...(teams || []).map(team => ({
        title: `#${team.slug}`,
        description: 'Team Settings',
        model: team,
        sourceType: 'team',
        resultType: 'settings',
        to: `/settings/${orgId}/teams/${team.slug}/`,
      })),
      ...(members || []).map(member => ({
        title: member.name,
        description: member.email,
        model: member,
        sourceType: 'member',
        resultType: 'settings',
        to: `/settings/${orgId}/members/${member.id}/`,
      })),
    ];

    let fuzzy = createFuzzySearch(allResults, {
      ...searchOptions,
      keys: ['title', 'description'],
    });

    this.setState({
      loading: false,
      allResults,
      fuzzy: await fuzzy,
    });
  }, 150);

  render() {
    let {children, query} = this.props;
    let {fuzzy} = this.state;

    let results = (fuzzy && fuzzy.search(query)) || null;
    return children({
      isLoading: this.state.loading,
      allResults: this.state.allResults,
      results,
    });
  }
}

export {ApiSource};
export default withLatestContext(withRouter(ApiSource));
