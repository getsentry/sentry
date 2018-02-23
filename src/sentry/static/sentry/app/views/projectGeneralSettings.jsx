import {Box} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';

import {getOrganizationState} from '../mixins/organizationState';
import {t, tct} from '../locale';
import AsyncView from './asyncView';
import Form from './settings/components/forms/form';

import FieldControl from './settings/components/forms/field/fieldControl';
import FieldDescription from './settings/components/forms/field/fieldDescription';
import FieldLabel from './settings/components/forms/field/fieldLabel';
import FieldHelp from './settings/components/forms/field/fieldHelp';
import FieldWrapper from './settings/components/forms/field/fieldWrapper';
import JsonForm from './settings/components/forms/jsonForm';
import Panel from './settings/components/panel';
import PanelAlert from './settings/components/panelAlert';
import PanelHeader from './settings/components/panelHeader';
import SettingsPageHeader from './settings/components/settingsPageHeader';
import TextBlock from './settings/components/text/textBlock';
import projectFields from '../data/forms/projectGeneralSettings';

const noMargin = {marginBottom: 0};

const AutoResolveFooter = () => (
  <Box p={2} pb={0}>
    <PanelAlert type="warning" icon="icon-circle-exclamation" css={noMargin}>
      <strong>
        {t(`Note: Enabling auto resolve will immediately resolve anything that has
                  not been seen within this period of time. There is no undo!`)}
      </strong>
    </PanelAlert>
  </Box>
);

export default class ProjectGeneralSettings extends AsyncView {
  static contextTypes = {
    organization: PropTypes.object.isRequired,
  };

  getEndpoint() {
    let {orgId, projectId} = this.props.params;
    return `/projects/${orgId}/${projectId}/`;
  }

  renderRemoveProject() {
    let {orgId, projectId} = this.props.params;

    let project = this.state.data;

    let isProjectAdmin = getOrganizationState(this.context.organization)
      .getAccess()
      .has('project:admin');

    if (!isProjectAdmin) {
      return (
        <FieldWrapper inline>
          <FieldDescription inline>
            <FieldHelp>
              {t('You do not have the required permission to remove this project.')}
            </FieldHelp>
          </FieldDescription>
        </FieldWrapper>
      );
    } else if (project.isInternal) {
      return (
        <FieldWrapper inline>
          <FieldDescription inline>
            <FieldHelp>
              {t(
                'This project cannot be removed. It is used internally by the Sentry server.'
              )}
            </FieldHelp>
          </FieldDescription>
        </FieldWrapper>
      );
    } else {
      return (
        <FieldWrapper inline>
          <FieldDescription inline>
            <FieldLabel>{t('Remove Project')}</FieldLabel>
            <FieldHelp>
              Remove the <strong>{project.slug}</strong> project and all related data.
              <br />
              Careful, this action cannot be undone.
            </FieldHelp>
          </FieldDescription>
          <FieldControl>
            <a
              href={`/${orgId}/${projectId}/settings/remove/`}
              className="btn btn-danger"
            >
              {t('Remove Project')}
            </a>
          </FieldControl>
        </FieldWrapper>
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
        <FieldWrapper inline>
          <FieldDescription inline>
            <FieldHelp>
              {t('You do not have the required permission to transfer this project.')}
            </FieldHelp>
          </FieldDescription>
        </FieldWrapper>
      );
    } else if (project.isInternal) {
      return (
        <FieldWrapper inline>
          <FieldDescription inline>
            <FieldHelp>
              {t(
                'This project cannot be removed. It is used internally by the Sentry server.'
              )}
            </FieldHelp>
          </FieldDescription>
        </FieldWrapper>
      );
    } else {
      return (
        <FieldWrapper inline>
          <FieldDescription inline>
            <FieldLabel>{t('Transfer Project')}</FieldLabel>
            <FieldHelp>
              Transfer the <strong>{project.slug}</strong> project and all related data.
              <br />
              Careful, this action cannot be undone.
            </FieldHelp>
          </FieldDescription>
          <FieldControl>
            <a
              href={`/${orgId}/${projectId}/settings/transfer/`}
              className="btn btn-danger"
            >
              {t('Transfer Project')}
            </a>
          </FieldControl>
        </FieldWrapper>
      );
    }
  }

  renderBody() {
    let {organization} = this.context;
    let project = this.state.data;
    let {projectId} = this.props.params;
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

    return (
      <div>
        <SettingsPageHeader title={t('Project Settings')} />

        <Form
          saveOnBlur
          allowUndo
          initialData={initialData}
          apiMethod="PUT"
          apiEndpoint={this.getEndpoint()}
          onSubmitSuccess={resp => {
            // Reload if slug has changed
            if (projectId !== resp.slug) {
              // window.location = `/${orgId}/${resp.slug}/settings/`;
            }
          }}
        >
          <JsonForm
            forms={projectFields}
            additionalFieldProps={{organization}}
            access={new Set(organization.access)}
            renderBodyStart={({title}) => {
              if (title === 'Client Security') {
                return (
                  <Box p={2} pb={0}>
                    <PanelAlert type="info" icon="icon-circle-exclamation" css={noMargin}>
                      <TextBlock css={noMargin}>
                        {tct(
                          'Configure origin URLs which Sentry should accept events from. This is used for communication with clients like [link].',
                          {
                            link: (
                              <a href="https://github.com/getsentry/raven-js">raven-js</a>
                            ),
                          }
                        )}{' '}
                        {tct(
                          'This will restrict requests based on the [Origin] and [Referer] headers.',
                          {
                            Origin: <code>Origin</code>,
                            Referer: <code>Referer</code>,
                          }
                        )}
                      </TextBlock>
                    </PanelAlert>
                  </Box>
                );
              }
              return null;
            }}
            renderFooter={({title}) => {
              if (title === 'Event Settings') {
                return <AutoResolveFooter />;
              }
              return null;
            }}
          />
        </Form>

        <Panel>
          <PanelHeader>{t('Project Administration')}</PanelHeader>
          {this.renderRemoveProject()}
          {this.renderTransferProject()}
        </Panel>
      </div>
    );
  }
}
