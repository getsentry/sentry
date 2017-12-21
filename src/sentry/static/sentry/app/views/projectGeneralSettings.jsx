import PropTypes from 'prop-types';
import React from 'react';

import {
  ApiForm,
  BooleanField,
  RangeField,
  Select2Field,
  TextareaField,
  TextField,
} from '../components/forms';
import IndicatorStore from '../stores/indicatorStore';

import {t, tct} from '../locale';
import AsyncView from './asyncView';
import {getOrganizationState} from '../mixins/organizationState';

class ListAsTextareaField extends TextareaField {
  getValue(props, context) {
    let value = super.getValue(props, context);
    return value ? value.join('\n') : '';
  }

  coerceValue(value) {
    return value ? value.split('\n') : [];
  }
}

export default class ProjectGeneralSettings extends AsyncView {
  static contextTypes = {
    organization: PropTypes.object.isRequired,
  };

  getEndpoint() {
    let {orgId, projectId} = this.props.params;
    return `/projects/${orgId}/${projectId}/`;
  }

  getTeamChoices() {
    return this.context.organization.teams
      .filter(o => o.isMember)
      .map(o => [o.slug, o.slug]);
  }

  getResolveAgeAllowedValues() {
    let i = 0;
    let values = [];
    while (i <= 720) {
      values.push(i);
      if (i < 12) {
        i += 1;
      } else if (i < 24) {
        i += 3;
      } else if (i < 36) {
        i += 6;
      } else if (i < 48) {
        i += 12;
      } else {
        i += 24;
      }
    }
    return values;
  }

  formatResolveAgeLabel(val) {
    val = parseInt(val, 10);
    if (val === 0) {
      return 'Disabled';
    } else if (val > 23 && val % 24 === 0) {
      val = val / 24;
      return val + ' day' + (val != 1 ? 's' : '');
    }
    return val + ' hour' + (val != 1 ? 's' : '');
  }

  renderRemoveProject() {
    let {orgId, projectId} = this.props.params;

    let project = this.state.data;

    let isProjectAdmin = getOrganizationState(this.context.organization)
      .getAccess()
      .has('project:admin');

    if (!isProjectAdmin) {
      return (
        <p>{t('You do not have the required permission to remove this project.')}</p>
      );
    } else if (project.isInternal) {
      return (
        <p>
          {t(
            'This project cannot be removed. It is used internally by the Sentry server.'
          )}
        </p>
      );
    } else {
      return (
        <p>
          <a
            href={`/${orgId}/${projectId}/settings/remove/`}
            className="btn btn-danger pull-right"
          >
            {t('Remove Project')}
          </a>
          Remove the <strong>{project.slug}</strong> project and all related data.
          <br />
          Careful, this action cannot be undone.
        </p>
      );
    }
  }

  renderTransferProject() {
    let {orgId, projectId} = this.props.params;

    let project = this.state.data;
    let isProjectAdmin = getOrganizationState(this.context.organization)
      .getAccess()
      .has('project:admin');

    if (!isProjectAdmin) {
      return (
        <p>{t('You do not have the required permission to transfer this project.')}</p>
      );
    } else if (project.isInternal) {
      return (
        <p>
          {t(
            'This project cannot be removed. It is used internally by the Sentry server.'
          )}
        </p>
      );
    } else {
      return (
        <p>
          <a
            href={`/${orgId}/${projectId}/settings/transfer/`}
            className="btn btn-danger pull-right"
          >
            {t('Transfer Project')}
          </a>
          Transfer the <strong>{project.slug}</strong> project and all related data.
          <br />
          Careful, this action cannot be undone.
        </p>
      );
    }
  }

  renderBody() {
    // These values cannot be changed on a project basis if any of them are 'true' at the org level
    let orgOverrideFields = ['dataScrubber', 'dataScrubberDefaults', 'scrubIPAddresses'];

    let orgOverrides = orgOverrideFields.reduce((res, key) => {
      res[key] = this.context.organization[key];
      return res;
    }, {});

    let orgOverrideDisabledReason = t(
      "This option is enforced by your organization's settings and cannot be customized per-project."
    );

    let project = this.state.data;
    let {orgId, projectId} = this.props.params;
    let initialData = {
      name: project.name,
      slug: project.slug,
      team: project.team && project.team.slug,
      allowedDomains: project.allowedDomains,
      resolveAge: project.resolveAge,
      dataScrubber: project.dataScrubber,
      dataScrubberDefaults: project.dataScrubberDefaults,
      sensitiveFields: project.sensitiveFields,
      safeFields: project.safeFields,
      defaultEnvironment: project.defaultEnvironment,
      subjectPrefix: project.subjectPrefix,
      scrubIPAddresses: project.scrubIPAddresses,
      securityToken: project.securityToken,
      securityHeader: project.securityHeader,
      securityTokenHeader: project.securityTokenHeader,
      verifySSL: project.verifySSL,
      scrapeJavaScript: project.scrapeJavaScript,
    };

    let teamChoices = this.getTeamChoices();

    return (
      <div>
        <h2>{t('Project Settings')}</h2>
        <ApiForm
          initialData={initialData}
          apiMethod="PUT"
          apiEndpoint={this.getEndpoint()}
          onSubmitSuccess={resp => {
            IndicatorStore.add(t('Your changes were saved'), 'success', {duration: 2000});
            // Reload if slug has changed
            if (projectId !== resp.slug) {
              window.location = `/${orgId}/${resp.slug}/settings/`;
            }
          }}
        >
          <div className="box">
            <div className="box-header">
              <h3>{t('Project Details')}</h3>
            </div>
            <div className="box-content with-padding">
              <TextField
                name="name"
                label={t('Project Name')}
                required={true}
                placeholder={t('e.g. My Service Name')}
              />
              <TextField
                name="slug"
                label={t('Short name')}
                required={true}
                help={t('A unique ID used to identify this project.')}
              />
              {teamChoices.length > 1 ? (
                <Select2Field
                  name="team"
                  className="control-group"
                  label={t('Team')}
                  required={true}
                  choices={this.getTeamChoices()}
                />
              ) : null}
            </div>
          </div>

          <div className="box">
            <div className="box-header">
              <h3>{t('Email')}</h3>
            </div>
            <div className="box-content with-padding">
              <TextField
                name="subjectPrefix"
                label={t('Subject prefix')}
                help={t('Choose a custom prefix for emails from this project.')}
              />
            </div>
          </div>
          <div className="box">
            <div className="box-header">
              <h3>{t('Event Settings')}</h3>
            </div>
            <div className="box-content with-padding">
              <TextField
                name="defaultEnvironment"
                label={t('Default environment')}
                help={t('The default selected environment when viewing issues.')}
                placeholder={t('e.g. production')}
              />
              <RangeField
                name="resolveAge"
                label={t('Auto resolve')}
                help={t(
                  "Automatically resolve an issue if it hasn't been seen for this amount of time."
                )}
                min={0}
                max={720}
                step={1}
                allowedValues={this.getResolveAgeAllowedValues()}
                formatLabel={this.formatResolveAgeLabel}
              />
              <p>
                <small>
                  <strong>
                    Note: Enabling auto resolve will immediately resolve anything that has
                    not been seen within this period of time. There is no undo!
                  </strong>
                </small>
              </p>
            </div>
          </div>

          <div className="box">
            <div className="box-header">
              <h3>{t('Data Privacy')}</h3>
            </div>
            <div className="box-content with-padding">
              <BooleanField
                disabled={orgOverrides.dataScrubber}
                disabledReason={orgOverrideDisabledReason}
                value={orgOverrides.dataScrubber || null}
                name="dataScrubber"
                label={t('Data scrubber')}
                help={t('Enable server-side data scrubbing.')}
              />
              <BooleanField
                disabled={orgOverrides.dataScrubberDefaults}
                value={orgOverrides.dataScrubberDefaults || null}
                disabledReason={orgOverrideDisabledReason}
                name="dataScrubberDefaults"
                label={t('Use default scrubbers')}
                help={t(
                  'Apply default scrubbers to prevent things like passwords and credit cards from being stored.'
                )}
              />
              <ListAsTextareaField
                name="sensitiveFields"
                label={t('Additional sensitive fields')}
                help={t(
                  'Additional field names to match against when scrubbing data. Separate multiple entries with a newline.'
                )}
                placeholder={t('e.g. email')}
              />
              <ListAsTextareaField
                name="safeFields"
                label={t('Safe fields')}
                help={t(
                  'Field names which data scrubbers should ignore. Separate multiple entries with a newline.'
                )}
                placeholder={t('e.g. email')}
              />
              <BooleanField
                disabled={orgOverrides.scrubIPAddresses}
                value={orgOverrides.scrubIPAddresses || null}
                disabledReason={orgOverrideDisabledReason}
                name="scrubIPAddresses"
                label={t("Don't store IP Addresses")}
                help={t('Prevent IP addresses from being stored for new events.')}
              />
            </div>
          </div>

          <div className="box">
            <div className="box-header">
              <h3>{t('Client Security')}</h3>
            </div>
            <div className="box-content with-padding">
              <p>
                {tct(
                  'Configure origin URLs which Sentry should accept events from. This is used for communication with clients like [link].',
                  {
                    link: <a href="https://github.com/getsentry/raven-js">raven-js</a>,
                  }
                )}{' '}
                {tct(
                  'This will restrict requests based on the [Origin] and [Referer] headers.',
                  {
                    Origin: <code>Origin</code>,
                    Referer: <code>Referer</code>,
                  }
                )}
              </p>
              <ListAsTextareaField
                name="allowedDomains"
                label={t('Allowed domains')}
                help={t('Separate multiple entries with a newline. Cannot be empty.')}
                placeholder={t('e.g. https://example.com or example.com')}
              />
              <BooleanField
                name="scrapeJavaScript"
                label={t('Enable JavaScript source fetching')}
                help={t(
                  'Allow Sentry to scrape missing JavaScript source context when possible.'
                )}
              />
              <TextField
                name="securityToken"
                label={t('Security token')}
                help={t(
                  'Outbound requests matching Allowed Domains will have the header "{token_header}: {token}" appended.'
                )}
              />
              <TextField
                name="securityTokenHeader"
                label={t('Security token header')}
                help={t(
                  'Outbound requests matching Allowed Domains will have the header "{token_header}: {token}" appended.'
                )}
                placeholder={t('e.g. X-Sentry-Token')}
              />
              <BooleanField
                name="verifySSL"
                label={t('Verify TLS/SSL')}
                help={t(
                  'Outbound requests will verify TLS (sometimes known as SSL) connections.'
                )}
              />
            </div>
          </div>
          <div className="box">
            <div className="box-header">
              <h3>{t('Remove Project')}</h3>
            </div>
            <div className="box-content with-padding">{this.renderRemoveProject()}</div>
          </div>
          <div className="box">
            <div className="box-header">
              <h3>{t('Transfer Project')}</h3>
            </div>
            <div className="box-content with-padding">{this.renderTransferProject()}</div>
          </div>
        </ApiForm>
      </div>
    );
  }
}
