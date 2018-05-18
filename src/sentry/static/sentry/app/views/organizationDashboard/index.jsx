import React from 'react';
import Reflux from 'reflux';
import PropTypes from 'prop-types';
import createReactClass from 'create-react-class';
import {Flex} from 'grid-emotion';
import styled from 'react-emotion';

import {t} from 'app/locale';
import {changeDashboard} from 'app/actionCreators/preferences';
import AlphabeticalDashboard from 'app/views/organizationDashboard/alphabeticalDashboard';
import OrganizationState from 'app/mixins/organizationState';
import ProjectsStatsStore from 'app/stores/projectsStatsStore';
import PreferencesStore from 'app/stores/preferencesStore';
import SentryTypes from 'app/proptypes';
import SelectControl from 'app/components/forms/selectControl';
import TeamDashboard from 'app/views/organizationDashboard/teamDashboard';
import withTeams from 'app/utils/withTeams';
import withProjects from 'app/utils/withProjects';
import space from 'app/styles/space';

import OldDashboard from './oldDashboard';
import ProjectNav from './projectNav';

class Dashboard extends React.Component {
  static propTypes = {
    type: PropTypes.oneOf(['team', 'alphabetical']),
    teams: PropTypes.array,
    projects: PropTypes.array,
    organization: SentryTypes.Organization,
  };

  componentDidMount() {
    $(document.body).addClass('org-dashboard');
  }
  componentWillUnmount() {
    $(document.body).removeClass('org-dashboard');
    ProjectsStatsStore.reset();
  }

  render() {
    const {type, ...props} = this.props;

    if (type === null) return null;

    if (type === 'alphabetical') {
      return <AlphabeticalDashboard {...props} />;
    }

    // Default dashboard
    return <TeamDashboard {...props} />;
  }
}

const OrganizationDashboard = createReactClass({
  displayName: 'OrganizationDashboard',
  mixins: [OrganizationState, Reflux.listenTo(PreferencesStore, 'onPreferencesChange')],
  getInitialState() {
    return {
      dashboardType: PreferencesStore.getInitialState().dashboardType,
    };
  },

  onPreferencesChange(store) {
    if (store.dashboardType === this.state.dashboardType) return;
    this.setState({
      dashboardType: store.dashboardType,
    });
  },

  handleChangeDashboard({value}) {
    // Unmount old dashboard completely so that the UI seems a bit more responsive
    this.setState(
      {
        dashboardType: null,
      },
      () => {
        changeDashboard(value);
      }
    );
  },

  render() {
    const hasNewDashboardFeature = this.getFeatures().has('dashboard');

    if (hasNewDashboardFeature) {
      return (
        <Flex flex="1" direction="column" style={{position: 'relative'}}>
          <ProjectNav />
          <DashboardControls>
            <ProjectsHeader>{t('Projects')}</ProjectsHeader>
            <SelectControl
              searchable={false}
              placeholder="Sort dashboard by"
              style={{width: 130}}
              clearable={false}
              value={this.state.dashboardType}
              onChange={this.handleChangeDashboard}
              options={[
                {value: 'alphabetical', label: 'Alphabetical'},
                {value: 'teams', label: 'By Teams'},
              ]}
            />
          </DashboardControls>
          <Dashboard
            organization={this.context.organization}
            {...this.props}
            type={this.state.dashboardType}
          />
        </Flex>
      );
    } else {
      return <OldDashboard {...this.props} />;
    }
  },
});

export {Dashboard};
export default withTeams(withProjects(OrganizationDashboard));

const DashboardControls = styled(Flex)`
  border-bottom: 1px solid ${p => p.theme.borderLight};
  justify-content: space-between;
  align-items: center;
  padding: ${space(1)} 30px;
`;

const ProjectsHeader = styled('div')`
  font-weight: bold;
  font-size: 24px;
`;
