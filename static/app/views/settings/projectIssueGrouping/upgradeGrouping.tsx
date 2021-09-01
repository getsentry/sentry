import {Fragment, useEffect} from 'react';
import {Location} from 'history';

import {addLoadingMessage, clearIndicators} from 'app/actionCreators/indicator';
import ProjectActions from 'app/actions/projectActions';
import {Client} from 'app/api';
import Alert from 'app/components/alert';
import Button from 'app/components/button';
import {openConfirmModal} from 'app/components/confirm';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {t, tct} from 'app/locale';
import {EventGroupingConfig, Organization, Project} from 'app/types';
import handleXhrErrorResponse from 'app/utils/handleXhrErrorResponse';
import marked from 'app/utils/marked';
import Field from 'app/views/settings/components/forms/field';
import TextBlock from 'app/views/settings/components/text/textBlock';

import {getGroupingChanges, getGroupingRisk} from './utils';

const upgradeGroupingId = 'upgrade-grouping';

type Props = {
  groupingConfigs: EventGroupingConfig[];
  organization: Organization;
  projectId: string;
  project: Project;
  onUpgrade: () => void;
  api: Client;
  location: Location;
};

function UpgradeGrouping({
  groupingConfigs,
  organization,
  projectId,
  project,
  onUpgrade,
  api,
  location,
}: Props) {
  const hasProjectWriteAccess = organization.access.includes('project:write');
  const {updateNotes, riskLevel, latestGroupingConfig} = getGroupingChanges(
    project,
    groupingConfigs
  );
  const {riskNote, alertType} = getGroupingRisk(riskLevel);
  const noUpdates = !latestGroupingConfig;
  const priority = riskLevel >= 2 ? 'danger' : 'primary';

  useEffect(() => {
    if (
      location.hash !== `#${upgradeGroupingId}` ||
      noUpdates ||
      !groupingConfigs ||
      !hasProjectWriteAccess
    ) {
      return;
    }
    handleOpenConfirmModal();
  }, [location.hash]);

  if (!groupingConfigs) {
    return null;
  }

  async function handleConfirmUpgrade() {
    const newData: Record<string, string | number> = {};

    if (latestGroupingConfig) {
      const now = Math.floor(new Date().getTime() / 1000);
      const ninety_days = 3600 * 24 * 90;

      newData.groupingConfig = latestGroupingConfig.id;
      newData.secondaryGroupingConfig = project.groupingConfig;
      newData.secondaryGroupingExpiry = now + ninety_days;
    }

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
  }

  function handleOpenConfirmModal() {
    openConfirmModal({
      confirmText: t('Upgrade'),
      priority,
      onConfirm: handleConfirmUpgrade,
      message: (
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
      ),
    });
  }

  function getButtonTitle() {
    if (!hasProjectWriteAccess) {
      return t('You do not have sufficient permissions to do this');
    }

    if (noUpdates) {
      return t('You are already on the latest version');
    }

    return undefined;
  }

  return (
    <Panel id={upgradeGroupingId}>
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
          <div>
            <Button
              onClick={handleOpenConfirmModal}
              disabled={!hasProjectWriteAccess || noUpdates}
              title={getButtonTitle()}
              type="button"
              priority={priority}
            >
              {t('Upgrade Grouping Strategy')}
            </Button>
          </div>
        </Field>
      </PanelBody>
    </Panel>
  );
}

export default UpgradeGrouping;
