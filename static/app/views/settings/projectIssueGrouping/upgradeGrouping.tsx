import {Fragment} from 'react';

import {addLoadingMessage, clearIndicators} from 'app/actionCreators/indicator';
import ProjectActions from 'app/actions/projectActions';
import {Client} from 'app/api';
import Alert from 'app/components/alert';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {t, tct} from 'app/locale';
import {EventGroupingConfig, Organization, Project} from 'app/types';
import handleXhrErrorResponse from 'app/utils/handleXhrErrorResponse';
import marked from 'app/utils/marked';
import Field from 'app/views/settings/components/forms/field';
import TextBlock from 'app/views/settings/components/text/textBlock';

import {getGroupingChanges, getGroupingRisk} from './utils';

type Props = {
  groupingConfigs: EventGroupingConfig[];
  organization: Organization;
  projectId: string;
  project: Project;
  onUpgrade: () => void;
  api: Client;
};

function UpgradeGrouping({
  groupingConfigs,
  organization,
  projectId,
  project,
  onUpgrade,
  api,
}: Props) {
  const hasAccess = organization.access.includes('project:write');
  const {updateNotes, riskLevel, latestGroupingConfig} = getGroupingChanges(
    project,
    groupingConfigs
  );
  const {riskNote, alertType} = getGroupingRisk(riskLevel);
  const noUpdates = !latestGroupingConfig;

  const newData: Record<string, string> = {};
  if (latestGroupingConfig) {
    newData.groupingConfig = latestGroupingConfig.id;
  }

  const handleUpgrade = async () => {
    addLoadingMessage(t('Changing grouping\u2026'));
    try {
      const response = await api.requestPromise(
        `/projects/${organization.slug}/${projectId}/`,
        {
          method: 'PUT',
          data: newData,
        }
      );
      clearIndicators();
      ProjectActions.updateSuccess(response);
      onUpgrade();
    } catch {
      handleXhrErrorResponse(t('Unable to upgrade config'));
    }
  };

  if (!groupingConfigs) {
    return null;
  }

  function getModalMessage() {
    return (
      <Fragment>
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
      </Fragment>
    );
  }

  function getButtonTitle() {
    if (!hasAccess) {
      return t('You do not have sufficient permissions to do this');
    }
    if (noUpdates) {
      return t('You are already on the latest version');
    }

    return undefined;
  }

  return (
    <Panel id="upgrade-grouping">
      <PanelHeader>{t('Upgrade Grouping')}</PanelHeader>
      <PanelBody>
        <Field
          label={t('Upgrade Grouping Strategy')}
          help={tct(
            'If the project uses an old grouping strategy an update is possible.[linebreak]Doing so will cause new events to group differently.',
            {
              linebreak: <br />,
            }
          )}
          disabled
        >
          <Confirm
            disabled={noUpdates}
            onConfirm={handleUpgrade}
            priority={riskLevel >= 2 ? 'danger' : 'primary'}
            confirmText={t('Upgrade')}
            message={getModalMessage()}
          >
            <div>
              <Button
                disabled={!hasAccess || noUpdates}
                title={getButtonTitle()}
                type="button"
                priority={riskLevel >= 2 ? 'danger' : 'primary'}
              >
                {t('Upgrade Grouping Strategy')}
              </Button>
            </div>
          </Confirm>
        </Field>
      </PanelBody>
    </Panel>
  );
}

export default UpgradeGrouping;
