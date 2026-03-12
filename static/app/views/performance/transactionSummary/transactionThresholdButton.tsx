import {useEffect, useState} from 'react';

import {Button} from '@sentry/scraps/button';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import type {Client} from 'sentry/api';
import {IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import type EventView from 'sentry/utils/discover/eventView';
import withApi from 'sentry/utils/withApi';
import {withProjects} from 'sentry/utils/withProjects';

import type {TransactionThresholdMetric} from './transactionThresholdModal';
import TransactionThresholdModal, {modalCss} from './transactionThresholdModal';
import {useEventViewProject} from './useEventViewProject';

type Props = {
  api: Client;
  eventView: EventView;
  organization: Organization;
  projects: Project[];
  transactionName: string;
  onChangeThreshold?: (threshold: number, metric: TransactionThresholdMetric) => void;
};

function TransactionThresholdButton({
  api,
  eventView,
  onChangeThreshold,
  organization,
  projects,
  transactionName,
}: Props) {
  const [loadingThreshold, setLoadingThreshold] = useState(false);
  const [transactionThreshold, setTransactionThreshold] = useState<number>();
  const [transactionThresholdMetric, setTransactionThresholdMetric] =
    useState<TransactionThresholdMetric>();

  const project = useEventViewProject(projects, eventView);

  useEffect(() => {
    if (!defined(project)) {
      return;
    }
    const transactionThresholdUrl = `/organizations/${organization.slug}/project-transaction-threshold-override/`;

    setLoadingThreshold(true);

    api
      .requestPromise(transactionThresholdUrl, {
        method: 'GET',
        includeAllArgs: true,
        query: {
          project: project.id,
          transaction: transactionName,
        },
      })
      .then(([data]) => {
        setLoadingThreshold(false);
        setTransactionThreshold(data.threshold);
        setTransactionThresholdMetric(data.metric);
      })
      .catch(() => {
        const projectThresholdUrl = `/projects/${organization.slug}/${project.slug}/transaction-threshold/configure/`;
        api
          .requestPromise(projectThresholdUrl, {
            method: 'GET',
            includeAllArgs: true,
            query: {
              project: project.id,
            },
          })
          .then(([data]) => {
            setLoadingThreshold(false);
            setTransactionThreshold(data.threshold);
            setTransactionThresholdMetric(data.metric);
          })
          .catch(err => {
            setLoadingThreshold(false);
            const errorMessage = err.responseJSON?.threshold ?? null;
            addErrorMessage(errorMessage);
          });
      });
  }, [api, project, organization.slug, transactionName]);

  function applyOnChangeThreshold(threshold: number, metric: TransactionThresholdMetric) {
    setTransactionThreshold(threshold);
    setTransactionThresholdMetric(metric);

    if (defined(onChangeThreshold)) {
      onChangeThreshold(threshold, metric);
    }
  }

  function openTransactionThresholdModal() {
    openModal(
      modalProps => (
        <TransactionThresholdModal
          {...modalProps}
          organization={organization}
          transactionName={transactionName}
          eventView={eventView}
          transactionThreshold={transactionThreshold}
          transactionThresholdMetric={transactionThresholdMetric}
          onApply={(threshold, metric) => applyOnChangeThreshold(threshold, metric)}
        />
      ),
      {modalCss, closeEvents: 'escape-key'}
    );
  }

  return (
    <Button
      size="sm"
      onClick={() => openTransactionThresholdModal()}
      icon={<IconSettings />}
      disabled={loadingThreshold}
      aria-label={t('Settings')}
      data-test-id="set-transaction-threshold"
    />
  );
}

export default withApi(withProjects(TransactionThresholdButton));
