import {RouteComponentProps} from 'react-router/lib/Router';
import React from 'react';
import PropTypes from 'prop-types';
import styled from '@emotion/styled';

import Alert from 'app/components/alert';
import {fields} from 'app/data/forms/projectIssueGrouping';
import {t, tct} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';
import {Organization, Project} from 'app/types';
import routeTitleGen from 'app/utils/routeTitle';
import ProjectActions from 'app/actions/projectActions';
import {addLoadingMessage, clearIndicators} from 'app/actionCreators/indicator';
import marked from 'app/utils/marked';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import Field from 'app/views/settings/components/forms/field';
import {FormPanel} from '../components/forms';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import ExternalLink from 'app/components/links/externalLink';

type Props = RouteComponentProps<{orgId: string; projectId: string}, {}> & {
  organization: Organization; // TODO: ???
  project: Project;
};

type State = AsyncView['state'];

class ProjectDebugSymbols extends AsyncView<Props, State> {
  static contextTypes = {
    organization: PropTypes.object.isRequired,
  };

  getTitle() {
    const {projectId} = this.props.params;

    return routeTitleGen(t('Issue Grouping'), projectId, false);
  }

  getDefaultState() {
    return {
      ...super.getDefaultState(),
    };
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {orgId, projectId} = this.props.params;

    return [
      ['data', `/projects/${orgId}/${projectId}/`],
      ['groupingConfigs', '/grouping-configs/'],
      ['groupingEnhancementBases', '/grouping-enhancements/'],
    ];
  }

  getGroupingChanges() {
    let updateNotes = '';
    const byId = {};
    let riskLevel = 0;
    let latestGroupingConfig = null;
    let latestEnhancementsBase = null;

    this.state.groupingConfigs.forEach(cfg => {
      byId[cfg.id] = cfg;
      if (cfg.latest && this.state.data.groupingConfig !== cfg.id) {
        updateNotes = cfg.changelog;
        latestGroupingConfig = cfg;
        riskLevel = cfg.risk;
      }
    });

    if (latestGroupingConfig) {
      let next = latestGroupingConfig.base;
      while (next !== this.state.data.groupingConfig) {
        const cfg = byId[next];
        if (!cfg) {
          break;
        }
        riskLevel = Math.max(riskLevel, cfg.risk);
        updateNotes = cfg.changelog + '\n' + updateNotes;
        next = cfg.base;
      }
    }

    this.state.groupingEnhancementBases.forEach(cfg => {
      if (cfg.latest && this.state.data.groupingEnhancementsBase !== cfg.id) {
        updateNotes += '\n\n' + cfg.changelog;
        latestEnhancementsBase = cfg;
      }
    });

    return {updateNotes, riskLevel, latestGroupingConfig, latestEnhancementsBase};
  }

  renderUpgradeGrouping = () => {
    const {orgId, projectId} = this.props.params;

    if (!this.state.groupingConfigs || !this.state.groupingEnhancementBases) {
      return null;
    }

    const {
      updateNotes,
      riskLevel,
      latestGroupingConfig,
      latestEnhancementsBase,
    } = this.getGroupingChanges();
    const noUpdates = !latestGroupingConfig && !latestEnhancementsBase;
    const newData = {};
    if (latestGroupingConfig) {
      newData.groupingConfig = latestGroupingConfig.id;
    }
    if (latestEnhancementsBase) {
      newData.groupingEnhancementsBase = latestEnhancementsBase.id;
    }

    let riskNote;
    let alertType;
    switch (riskLevel) {
      case 0:
        riskNote = t('This upgrade has the chance to create some new issues.');
        alertType = 'info';
        break;
      case 1:
        riskNote = t('This upgrade will create some new issues.');
        alertType = 'warning';
        break;
      case 2:
        riskNote = (
          <strong>
            {t(
              'The new grouping strategy is incompatible with the current and will create entirely new issues.'
            )}
          </strong>
        );
        alertType = 'error';
        break;
      default:
    }

    return (
      <Field
        label={t('Upgrade Grouping Strategy')}
        help={tct(
          'If the project uses an old grouping strategy an update is possible.[linebreak]Doing so will cause new events to group differently.',
          {
            linebreak: <br />,
          }
        )}
      >
        <Confirm
          disabled={noUpdates}
          onConfirm={() => {
            addLoadingMessage(t('Changing grouping...'));
            this.api
              .requestPromise(`/projects/${orgId}/${projectId}/`, {
                method: 'PUT',
                data: newData,
              })
              .then(resp => {
                clearIndicators();
                ProjectActions.updateSuccess(resp);
                this.fetchData();
              }, handleXhrErrorResponse('Unable to upgrade config'));
          }}
          priority={riskLevel >= 2 ? 'danger' : 'primary'}
          title={t('Upgrade grouping strategy?')}
          confirmText={t('Upgrade')}
          message={
            <div>
              <TextBlock>
                <strong>{t('Upgrade Grouping Strategy')}</strong>
              </TextBlock>
              <TextBlock>
                {t(
                  'You can upgrade the grouping strategy to the latest but this is an irreversible operation.'
                )}
              </TextBlock>
              <TextBlock>
                <strong>{t('New Behavior')}</strong>
                <div dangerouslySetInnerHTML={{__html: marked(updateNotes)}} />
              </TextBlock>
              <TextBlock>
                <Alert type={alertType}>{riskNote}</Alert>
              </TextBlock>
            </div>
          }
        >
          <div>
            <Button
              disabled={noUpdates}
              title={noUpdates ? t('You are already on the latest version') : null}
              className="ref-upgrade-grouping-strategy"
              type="button"
              priority={riskLevel >= 2 ? 'danger' : 'primary'}
            >
              {t('Update Grouping Strategy')}
            </Button>
          </div>
        </Confirm>
      </Field>
    );
  };

  renderBody() {
    const {organization} = this.context;
    const project = this.state.data;
    const {orgId, projectId} = this.props.params;
    const endpoint = `/projects/${orgId}/${projectId}/`;
    const access = new Set(organization.access);
    const jsonFormProps = {
      additionalFieldProps: {
        organization,
        groupingConfigs: this.state.groupingConfigs,
        groupingEnhancementBases: this.state.groupingEnhancementBases,
      },
      features: new Set(organization.features),
      access,
      disabled: !access.has('project:write'),
    };

    return (
      <React.Fragment>
        <SettingsPageHeader title={t('Issue Grouping')} />

        <TextBlock>
          {tct(
            `All events have a fingerprint. Events with the same fingerprint are grouped together into an issue. To learn more about issue grouping, [link: read the docs].`,
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platform-redirect/?next=%2Fdata-management%2Fevent-grouping%2F" />
              ),
            }
          )}
        </TextBlock>

        <Form
          saveOnBlur
          allowUndo
          initialData={{
            ...project,
            team: project.team && project.team.slug,
          }}
          apiMethod="PUT"
          apiEndpoint={endpoint}
          onSubmitSuccess={resp => {
            // this is necessary for the grouping upgrade button to be
            // updating based on the current selection of the grouping
            // config.
            this.setState({data: resp});
            if (projectId !== resp.slug) {
              changeProjectSlug(projectId, resp.slug);
              // Container will redirect after stores get updated with new slug
              this.props.onChangeSlug(resp.slug);
            }
            // This will update our project context
            ProjectActions.updateSuccess(resp);
          }}
        >
          <JsonForm
            {...jsonFormProps}
            title={<React.Fragment>{t('Fingerprint Rules')}</React.Fragment>}
            fields={[fields.fingerprintingRules]}
          />

          <JsonForm
            {...jsonFormProps}
            title={<React.Fragment>{t('Stacktrace Rules')}</React.Fragment>}
            fields={[fields.groupingEnhancements]}
          />

          <Panel id="upgrade-grouping">
            <PanelHeader>{t('Upgrade Grouping')}</PanelHeader>
            <PanelBody>{this.renderUpgradeGrouping()}</PanelBody>
          </Panel>

          <JsonForm
            {...jsonFormProps}
            title={<React.Fragment>{t('Change defaults')}</React.Fragment>}
            fields={[fields.groupingConfig, fields.groupingEnhancementsBase]}
          />
        </Form>
      </React.Fragment>
    );
  }
}

export default ProjectDebugSymbols;
