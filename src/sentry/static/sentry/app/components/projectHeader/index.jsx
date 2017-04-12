import React from 'react';

import ProjectSelector from './projectSelector';
import BookmarkToggle from '../projects/bookmarkToggle';

import {t} from '../../locale';

const ProjectHeader = React.createClass({
  propTypes: {
    project: React.PropTypes.object.isRequired,
    organization: React.PropTypes.object.isRequired,
    activeSection: React.PropTypes.string
  },

  render() {
    let navSection = this.props.activeSection;
    let project = this.props.project;
    let org = this.props.organization;
    let access = new Set(org.access);

    return (
      <div className="sub-header flex flex-container flex-vertically-centered">
        <div>
          <ProjectSelector
              organization={org}
              projectId={project.slug}/>
        </div>

        <div className="align-right project-actions">
          <BookmarkToggle orgId={org.slug} project={project}>
            <a className="btn btn-sm btn-default">
              <span className={project.isBookmarked ? 'icon icon-star-solid active' : 'icon icon-star-solid'}/>
              {project.isBookmarked ?
                <span>{t('Unstar Project')}</span>
              :
                <span>{t('Star Project')}</span>
              }
            </a>
          </BookmarkToggle>
          {access.has('project:write') &&
            <a className={navSection == 'settings' ? 'btn btn-sm btn-default active' : 'btn btn-sm btn-default'} href={`/${org.slug}/${project.slug}/settings/`}>
              <span className="icon icon-settings" /> {t('Project Settings')}
            </a>
          }
        </div>
      </div>
    );
  }
});

export default ProjectHeader;
