import {Fragment, useEffect} from 'react';
import {Location} from 'history';

import {addLoadingMessage, clearIndicators} from 'sentry/actionCreators/indicator';
import ProjectActions from 'sentry/actions/projectActions';
import {Client} from 'sentry/api';
import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import {openConfirmModal} from 'sentry/components/confirm';
import Field from 'sentry/components/forms/field';
import {Panel, PanelBody, PanelHeader} from 'sentry/components/panels';
import {t, tct} from 'sentry/locale';
import {EventGroupingConfig, Organization, Project} from 'sentry/types';
import handleXhrErrorResponse from 'sentry/utils/handleXhrErrorResponse';
import marked from 'sentry/utils/marked';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

import {getGroupingChanges, getGroupingRisk} from './utils';

const upgradeGroupingId = 'upgrade-grouping';

type Props = {
  api: Client;
  groupingConfigs: EventGroupingConfig[];
  location: Location;
  onUpgrade: () => void;
  organization: Organization;
  project: Project;
  projectId: string;
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
