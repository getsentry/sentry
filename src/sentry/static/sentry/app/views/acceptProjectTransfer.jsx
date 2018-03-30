import React from 'react';

import {addErrorMessage, addSuccessMessage} from '../actionCreators/indicator';
import AsyncView from './asyncView';
import Form from './settings/components/forms/form';
import NarrowLayout from '../components/narrowLayout';
import Select2Field from './settings/components/forms/select2Field';
import SettingsPageHeader from './settings/components/settingsPageHeader';
import {t, tct} from '../locale';

class AcceptProjectTransfer extends AsyncView {
  getEndpoints() {
    let query = this.props.location.query;
    return [['transferDetails', '/accept-transfer/', {query}]];
  }

  getTitle() {
    return t('Accept Project Transfer');
  }

  handleSubmit = formData => {
    let teamId = formData.team;
    this.api.request('/accept-transfer/', {
      method: 'POST',
      data: {
        data: this.props.location.query.data,
        team: teamId,
      },
      success: () => {
        let orgSlug;
        this.state.transferDetails.organizations.forEach(o => {
          if (!orgSlug) {
            o.teams.forEach(team => {
              if (team.id === teamId) {
                orgSlug = o.slug;
              }
            });
          }
        });
        this.props.router.push(`/${orgSlug}`);
        addSuccessMessage(t('Project successfully transferred'));
      },
      error: error => {
        addErrorMessage(t('Unable to transfer project.'));
      },
    });
  };

  renderBody() {
    let {transferDetails} = this.state;
    let choices = [];
    transferDetails.organizations.forEach(org => {
      org.teams.forEach(team => {
        choices.push([team.id, `#${team.slug} - ${org.slug}`]);
      });
    });
    return (
      <NarrowLayout>
        <SettingsPageHeader title={t('Approve Transfer Project Request')} />
        <p>
          {tct(
            'Projects must be transferred to a specific [team] in order to be moved over to another [organization]. ' +
              'You can always change the team later under the [projectSettings].',
            {
              team: <strong>{t('Team')}</strong>,
              organization: <strong>{t('Organization')}</strong>,
              projectSettings: <strong>{t('Project Settings')}</strong>,
            }
          )}
        </p>
        <p>
          {tct('Please select which [team] you want for the project [project].', {
            team: <strong>{t('Team')}</strong>,
            project: transferDetails.project.slug,
          })}
        </p>
        <Form
          onSubmit={this.handleSubmit}
          submitLabel={t('Transfer Project')}
          submitPriority="danger"
          initialData={{team: choices[0] && choices[0][0]}}
        >
          <Select2Field
            choices={choices}
            label={t('Team')}
            name="team"
            style={{borderBottom: 'none'}}
          />
        </Form>
      </NarrowLayout>
    );
  }
}

export default AcceptProjectTransfer;
