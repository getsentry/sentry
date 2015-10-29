import jQuery from "jquery";
import React from "react";
import {Link, History} from "react-router";

import api from "../api";
import LoadingError from "../components/loadingError";
import LoadingIndicator from "../components/loadingIndicator";
import Pagination from "../components/pagination";
import SearchBar from "../components/searchBar.jsx";

const AdminOrganizations = React.createClass({
  mixins: [History],

  getInitialState() {
    let queryParams = this.props.location.query;

    return {
      data: [],
      loading: true,
      error: false,
      query: queryParams.query || '',
      pageLinks: '',
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  componentWillReceiveProps(nextProps) {
    if (nextProps.location.search !== this.props.location.search) {
      this.setState({
        query: this.props.location.query,
        loading: true,
        error: false
      }, this.fetchData);
    }
  },

  remountComponent() {
    this.setState(this.getInitialState(), this.fetchData);
  },

  fetchData() {
    let queryParams = this.props.location.query;

    api.request(`/organizations/`, {
      method: 'GET',
      data: queryParams,
      success: (data, _, jqXHR) => {
        this.setState({
          data: data,
          error: false,
          loading: false,
          pageLinks: jqXHR.getResponseHeader('Link')
        });
      },
      error: (error) => {
        this.setState({
          error: true,
          loading: false
        });
      }
    });
  },

  onPage(cursor) {
    let queryParams = jQuery.extend({}, this.props.location.query, {
      cursor: cursor
    });
    this.history.pushState(null, '/manage/organizations/', queryParams);
  },

  onSearch(query) {
    let targetQueryParams = {};
    if (query !== '')
      targetQueryParams.query = query;

    this.history.pushState(null, '/manage/organizations/', targetQueryParams);
  },

  renderLoading() {
    return (
      <tr>
        <td colSpan="3">
          <LoadingIndicator />
        </td>
      </tr>
    );
  },

  renderError() {
    return (
      <tr>
        <td colSpan="3">
          <LoadingError onRetry={this.remountComponent} />
        </td>
      </tr>
    );
  },

  renderNoResults() {
    return (
      <tr>
        <td colSpan="3">
          <span className="icon icon-exclamation" />
          <p>Sorry, no results match your filters.</p>
        </td>
      </tr>
    );
  },

  renderResults() {
    return this.state.data.map((item) => {
      return (
        <tr>
          <td>
            <Link to={`/${item.slug}/`}>
              {item.name}
            </Link><br />
            <small>{item.slug}</small>
          </td>
          <td>&mdash;</td>
          <td>&mdash;</td>
        </tr>
      );
    });
  },

  render() {
    return (
      <div>
        <div className="row">
          <div className="col-sm-7">
            <h3>Organizations</h3>
          </div>
          <div className="col-sm-5">
            <SearchBar defaultQuery=""
              placeholder="Search for an organization."
              query={this.state.query}
              onSearch={this.onSearch}
            />
          </div>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>Organization</th>
              <th style={{width: 100}}>Members</th>
              <th style={{width: 100}}>Projects</th>
            </tr>
          </thead>
          <tbody>
            {this.state.loading ?
              this.renderLoading()
            : (this.state.error ?
              this.renderError()
            : (this.state.data.length === 0 ?
              this.renderNoResults()
            :
              this.renderResults()
            ))}
          </tbody>
        </table>
        <Pagination pageLinks={this.state.pageLinks} onPage={this.onPage} />
      </div>
    );
  }
});

export default AdminOrganizations;
