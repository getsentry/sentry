import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import {Link} from 'react-router';

import ProjectSparkline from 'app/views/organizationDashboard/projectSparkline';
import OrganizationState from 'app/mixins/organizationState';
import {sortArray} from 'app/utils';
import {t, tct} from 'app/locale';

const ProjectListOld = createReactClass({
  displayName: 'ProjectListOld',

  propTypes: {
    projects: PropTypes.array,
    maxProjects: PropTypes.number,
  },

  mixins: [OrganizationState],

  getDefaultProps() {
    return {
      maxProjects: 8,
    };
  },

  render() {
    let org = this.getOrganization();
    let {maxProjects, projects} = this.props;

    projects = sortArray(projects, item => {
      return [!item.isBookmarked, item.team && item.team.name, item.name];
    });

    // project list is
    // a) all bookmarked projects
    // b) if bookmarked projcets < maxProjects, then fill with sorted projects until maxProjects

    let bookmarkedProjects = projects.filter(p => p.isBookmarked);
    if (bookmarkedProjects.length < maxProjects) {
      projects = bookmarkedProjects.concat(
        projects.slice(bookmarkedProjects.length, maxProjects)
      );
    } else {
      projects = bookmarkedProjects;
    }

    return (
      <div className="organization-dashboard-projects">
        <Link className="btn-sidebar-header" to={`/organizations/${org.slug}/teams/`}>
          {t('View All')}
        </Link>
        <h6 className="nav-header">{t('Projects')}</h6>
        {bookmarkedProjects.length === 0 && (
          <div className="alert alert-info" style={{marginBottom: 10}}>
            {tct('Bookmark your most used [projects:projects] to have them appear here', {
              projects: <Link to={`/organizations/${org.slug}/teams/`} />,
            })}
          </div>
        )}
        <ul className="nav nav-stacked">
          {projects.map(project => {
            return (
              <li key={project.id}>
                <div className="pull-right sparkline">
                  {project.stats && <ProjectSparkline data={project.stats} />}
                </div>
                <Link to={`/${org.slug}/${project.slug}/`}>
                  <h4>
                    {project.isBookmarked && (
                      <span className="bookmark icon-star-solid" />
                    )}
                    {project.name}
                  </h4>
                  <h5>{project.team ? project.team.name : <span>&nbsp;</span>}</h5>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    );
  },
});

export default ProjectListOld;
