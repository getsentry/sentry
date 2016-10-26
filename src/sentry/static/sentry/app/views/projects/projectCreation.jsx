import React from 'react';
import {Link} from 'react-router';

import TextField from '../../components/forms/textField';
import OrganizationState from '../../mixins/organizationState';
import ProjectSelector from '../../components/projectHeader/projectSelector';

import {t} from '../../locale';

const ProjectCreation = React.createClass({
  mixins: [
    OrganizationState,
  ],

  componentDidMount() {
    document.body.className += 'narrow';
  },

  onSubmit() {
    alert('lol');
  },

  render() {
    let org = this.getOrganization();

    return (
      <div className="organization-home">
        <div className="sub-header">
          <div className="container">
            <div className="org-name">
              <Link to={`/${org.slug}/`}>
                {org.name}
              </Link>
            </div>
            <ProjectSelector
                organization={org} />
          </div>
        </div>
        <div className="container">
          <div className="page-header">
            <h2>{t('Create a New Project')}</h2>
          </div>
          <p>Projects allow you to scope events to a specific application in your organization. For example, you might have separate projects for production vs development instances, or separate projects for your web app and mobile app.</p>

          <form onSubmit={this.onSubmit}>
            <TextField type="text" label="Name" placeholder="i.e. API, Frontend, My Application Name"/>
          </form>
        </div>
      </div>
    );
  }
});

export default ProjectCreation;
