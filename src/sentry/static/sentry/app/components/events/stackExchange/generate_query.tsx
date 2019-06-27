import React from 'react';
import PropTypes from 'prop-types';
import _ from 'lodash';

import SentryTypes from 'app/sentryTypes';

const userPropTypes = {
  children: PropTypes.func.isRequired,
  api: PropTypes.object.isRequired,
  organization: SentryTypes.Organization.isRequired,
  project: SentryTypes.Project.isRequired,
  event: SentryTypes.Event.isRequired,
};

type GenerateQueryProps = PropTypes.InferProps<typeof userPropTypes>;

class GenerateQuery extends React.Component<GenerateQueryProps> {
  static propTypes = userPropTypes;

  state = {
    query: '',
    loading: true,
    error: null,
  };

  // eslint-disable-next-line react/sort-comp
  _isMounted = false;

  componentDidMount() {
    this._isMounted = true;

    this.fetchData();
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  fetchData = () => {
    const {api, project, organization, event} = this.props;

    this.setState({
      loading: true,
    });

    api.request(
      `/projects/${organization.slug}/${project.slug}/events/${event.id}/stackexchange/`,
      {
        success: data => {
          if (!this._isMounted) {
            return;
          }

          const query = _.get(data, ['query'], '');

          this.setState({
            query: _.isString(query) ? query : '',
            loading: false,
            error: null,
          });
        },
        error: err => {
          if (!this._isMounted) {
            return;
          }

          this.setState({
            query: '',
            questions: [],
            loading: false,
            error: err,
          });
        },
      }
    );
  };

  render() {
    if (this.state.loading) {
      return null;
    }

    if (!!this.state.error) {
      return null;
    }

    const childProps = {
      query: this.state.query,
    };

    return this.props.children(childProps);
  }
}

export default GenerateQuery;
