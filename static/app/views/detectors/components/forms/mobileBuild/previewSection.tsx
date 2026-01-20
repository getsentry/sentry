import styled from '@emotion/styled';

import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {Container} from 'sentry/components/workflowEngine/ui/container';
import Section from 'sentry/components/workflowEngine/ui/section';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useProjects from 'sentry/utils/useProjects';
import {
  PREPROD_DETECTOR_FORM_FIELDS,
  usePreprodDetectorFormField,
} from 'sentry/views/detectors/components/forms/mobileBuild/mobileBuildFormData';
import {getMetricLabel} from 'sentry/views/settings/project/preprod/types';

export function MobileBuildPreviewSection() {
  const metric = usePreprodDetectorFormField(PREPROD_DETECTOR_FORM_FIELDS.metric);
  const highThreshold = usePreprodDetectorFormField(
    PREPROD_DETECTOR_FORM_FIELDS.highThreshold
  );
  const measurement = usePreprodDetectorFormField(
    PREPROD_DETECTOR_FORM_FIELDS.measurement
  );
  const projectId = usePreprodDetectorFormField(PREPROD_DETECTOR_FORM_FIELDS.projectId);
  const {projects} = useProjects();

  const project = projects.find(p => p.id === projectId);
  const metricLabel = getMetricLabel(metric);

  const isPercentage = measurement === 'relative_diff';
  const threshold = highThreshold;
  const thresholdUnit = isPercentage ? '%' : 'MB';
  const thresholdDisplay = threshold ? `${threshold} ${thresholdUnit}` : '...';

  return (
    <Container>
      <Section
        title={t('Preview')}
        description={t(
          'Given your configurations, this is a sample of the kind of issue you can expect this Monitor to produce.'
        )}
      >
        <PreviewTable>
          <PreviewHeader>
            <HeaderCell>{t('Issue')}</HeaderCell>
            <HeaderCell>{t('Last Seen')}</HeaderCell>
            <HeaderCell>{t('Age')}</HeaderCell>
            <HeaderCell>{t('Events')}</HeaderCell>
            <HeaderCell>{t('Users')}</HeaderCell>
            <HeaderCell>{t('Assignee')}</HeaderCell>
          </PreviewHeader>
          <PreviewRow>
            <IssueCell>
              <IssueTitle>{t('%s Threshold Exceeded', metricLabel)}</IssueTitle>
              <IssueSubtitle>
                {t('129 MB > %s Threshold', thresholdDisplay)}
              </IssueSubtitle>
              <IssueMetadata>
                {project && <ProjectBadge project={project} avatarSize={14} hideName />}
                <span>/api/0/auth/</span>
              </IssueMetadata>
            </IssueCell>
            <DataCell>4hr</DataCell>
            <DataCell>2min</DataCell>
            <DataCell>1</DataCell>
            <DataCell>1.2k</DataCell>
            <DataCell />
          </PreviewRow>
        </PreviewTable>
      </Section>
    </Container>
  );
}

const PreviewTable = styled('div')`
  display: grid;
  grid-template-columns: 1fr repeat(5, auto);
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  overflow: hidden;
`;

const PreviewHeader = styled('div')`
  display: contents;

  > * {
    background: ${p => p.theme.tokens.background.secondary};
    padding: ${space(1)} ${space(1.5)};
    font-size: ${p => p.theme.fontSize.sm};
    font-weight: ${p => p.theme.fontWeight.bold};
    color: ${p => p.theme.tokens.content.secondary};
    border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  }
`;

const PreviewRow = styled('div')`
  display: contents;

  > * {
    padding: ${space(1.5)};
    font-size: ${p => p.theme.fontSize.md};
  }
`;

const HeaderCell = styled('div')``;

const IssueCell = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
`;

const IssueTitle = styled('div')`
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const IssueSubtitle = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.tokens.content.secondary};
`;

const IssueMetadata = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.tokens.content.secondary};
`;

const DataCell = styled('div')`
  text-align: right;
  color: ${p => p.theme.tokens.content.secondary};
`;
