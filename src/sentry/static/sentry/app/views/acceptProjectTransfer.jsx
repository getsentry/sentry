import React from 'react';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import AsyncView from 'app/views/asyncView';
import Form from 'app/views/settings/components/forms/form';
import NarrowLayout from 'app/components/narrowLayout';
import SelectField from 'app/views/settings/components/forms/selectField';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import {t, tct} from 'app/locale';

class AcceptProjectTransfer extends AsyncView {
  getEndpoints() {
    let query = this.props.location.query;
    return [['transferDetails', '/accept-transfer/', {query}]];
  }

  getTitle() {
    return t('Accept Project Transfer');
  }

  hasTeamsFeature() {
    let {transferDetails} = this.state;
    return transferDetails.organizations.every(org => {
      let features = new Set(org.features);
      return features.has('new-teams');
    });
  }

  handleSubmit = formData => {
    let hasTeamsFeature = this.hasTeamsFeature();
    let kwargs = hasTeamsFeature
      ? {organization: formData.organization}
      : {team: formData.team};
    this.api.request('/accept-transfer/', {
      method: 'POST',
      data: {
        data: this.props.location.query.data,
        ...kwargs,
      },
      success: () => {
        let orgSlug;
        if (hasTeamsFeature) {
          orgSlug = formData.organization;
        } else {
          this.state.transferDetails.organizations.forEach(o => {
            if (!orgSlug) {
              o.teams.forEach(team => {
                if (team.id === formData.team) {
                  orgSlug = o.slug;
                }
              });
            }
          });
        }
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
    let hasTeamsFeature = this.hasTeamsFeature();

    transferDetails.organizations.forEach(org => {
      if (hasTeamsFeature) {
        choices.push([org.slug, org.slug]);
      } else {
        org.teams.forEach(team => {
          choices.push([team.id, `#${team.slug} - ${org.slug}`]);
        });
      }
    });
    return (
      <NarrowLayout>
        <SettingsPageHeader title={t('Approve Transfer Project Request')} />
        <p>
          {hasTeamsFeature
            ? tct(
                'Projects must be transferred to a specific [organization]. ' +
                  'You can grant specific teams access to the project later under the [projectSettings].',
                {
                  organization: <strong>{t('Organization')}</strong>,
                  projectSettings: <strong>{t('Project Settings')}</strong>,
                }
              )
            : tct(
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
          {hasTeamsFeature
            ? tct(
                'Please select which [organization] you want for the project [project].',
                {
                  organization: <strong>{t('Organization')}</strong>,
                  project: transferDetails.project.slug,
                }
              )
            : tct('Please select which [team] you want for the project [project].', {
                team: <strong>{t('Team')}</strong>,
                project: transferDetails.project.slug,
              })}
        </p>
        <Form
          onSubmit={this.handleSubmit}
          submitLabel={t('Transfer Project')}
          submitPriority="danger"
          initialData={
            hasTeamsFeature
              ? {organization: choices[0] && choices[0][0]}
              : {team: choices[0] && choices[0][0]}
          }
        >
          <SelectField
            choices={choices}
            label={hasTeamsFeature ? t('Organization') : t('Team')}
            name={hasTeamsFeature ? 'organization' : 'team'}
            style={{borderBottom: 'none'}}
          />
        </Form>
      </NarrowLayout>
    );
  }
}

export default AcceptProjectTransfer;
