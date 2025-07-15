import {KeyValueTableRow} from 'sentry/components/keyValueTable';
import DetailLayout from 'sentry/components/workflowEngine/layout/detail';
import Section from 'sentry/components/workflowEngine/ui/section';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import type {UptimeDetector} from 'sentry/types/workflowEngine/detectors';
import getDuration from 'sentry/utils/duration/getDuration';
import {DetectorDetailsAssignee} from 'sentry/views/detectors/components/details/common/assignee';
import {DetectorDetailsAutomations} from 'sentry/views/detectors/components/details/common/automations';
import {DetectorExtraDetails} from 'sentry/views/detectors/components/details/common/extraDetails';
import {DetectorDetailsHeader} from 'sentry/views/detectors/components/details/common/header';
import {DetectorDetailsOngoingIssues} from 'sentry/views/detectors/components/details/common/ongoingIssues';

type UptimeDetectorDetailsProps = {
  detector: UptimeDetector;
  project: Project;
};

export function UptimeDetectorDetails({detector, project}: UptimeDetectorDetailsProps) {
  const dataSource = detector.dataSources[0];

  return (
    <DetailLayout>
      <DetectorDetailsHeader detector={detector} project={project} />
      <DetailLayout.Body>
        <DetailLayout.Main>
          <DetectorDetailsOngoingIssues />
          <DetectorDetailsAutomations detector={detector} />
        </DetailLayout.Main>
        <DetailLayout.Sidebar>
          <Section title={t('Detect')}>{t('Three consecutive failed checks.')}</Section>
          <Section title={t('Resolve')}>
            {t('Three consecutive successful checks.')}
          </Section>
          <DetectorDetailsAssignee owner={detector.owner} />
          <DetectorExtraDetails>
            <KeyValueTableRow
              keyName={t('Interval')}
              value={t('Every %s', getDuration(dataSource.queryObj.intervalSeconds))}
            />
            <KeyValueTableRow
              keyName={t('URL')}
              value={detector.dataSources[0].queryObj.url}
            />
            <KeyValueTableRow
              keyName={t('Method')}
              value={detector.dataSources[0].queryObj.method}
            />
            <DetectorExtraDetails.Environment detector={detector} />
            <DetectorExtraDetails.DateCreated detector={detector} />
            <DetectorExtraDetails.CreatedBy detector={detector} />
            <DetectorExtraDetails.LastModified detector={detector} />
          </DetectorExtraDetails>
        </DetailLayout.Sidebar>
      </DetailLayout.Body>
    </DetailLayout>
  );
}
