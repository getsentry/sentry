import {withRouter} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {fetchTeams} from 'app/actionCreators/teams';
import {t} from 'app/locale';
import withApi from 'app/utils/withApi';

const FetchTeams = withRouter(
  withApi(
    class FetchTeams extends React.Component {
      static propTypes = {
        showTeams: PropTypes.bool,
        api: PropTypes.object,
        router: PropTypes.object,
      };

      constructor() {
        super();
        this.state = {
          teams: null,
        };
      }

      componentDidMount() {
        const {showTeams, api, router} = this.props;
        if (!showTeams) {
          return;
        }

        fetchTeams(api, router.params).then(
          teams => this.setState({teams}),
          () => addErrorMessage(t('Error fetching teams'))
        );
      }

      render() {
        const {showTeams, children} = this.props;
        return children({
          teams: showTeams ? this.state.teams : [],
        });
      }
    }
  )
);

export default FetchTeams;
