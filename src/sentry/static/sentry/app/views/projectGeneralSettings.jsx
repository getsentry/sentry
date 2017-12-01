import React from 'react';

import {
  ApiForm,
  BooleanField,
  RangeField,
  Select2Field,
  TextareaField,
  TextField,
} from '../components/forms';
import {t, tct} from '../locale';
import AsyncView from './asyncView';

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
    organization: React.PropTypes.object.isRequired,
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
    while (i <= 168) {
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

  renderBody() {
    let project = this.state.data;
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
      scrubIpAddresses: project.scrubIpAddresses,
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
                max={168}
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
                name="dataScrubber"
                label={t('Data scrubber')}
                help={t('Enable server-side data scrubbing.')}
              />
              <BooleanField
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
                name="scrubIpAddresses"
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
        </ApiForm>
      </div>
    );
  }
}
