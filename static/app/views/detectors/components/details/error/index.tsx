import ExternalLink from 'sentry/components/links/externalLink';
import Placeholder from 'sentry/components/placeholder';
import DetailLayout from 'sentry/components/workflowEngine/layout/detail';
import Section from 'sentry/components/workflowEngine/ui/section';
import {t, tct, tn} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {useDetailedProject} from 'sentry/utils/useDetailedProject';
import useOrganization from 'sentry/utils/useOrganization';
import {DetectorDetailsAssignee} from 'sentry/views/detectors/components/details/common/assignee';
import {DetectorDetailsAutomations} from 'sentry/views/detectors/components/details/common/automations';
import {DetectorExtraDetails} from 'sentry/views/detectors/components/details/common/extraDetails';
import {DetectorDetailsHeader} from 'sentry/views/detectors/components/details/common/header';
import {DetectorDetailsOngoingIssues} from 'sentry/views/detectors/components/details/common/ongoingIssues';

type ErrorDetectorDetailsProps = {
  detector: Detector;
  project: Project;
};

const formatResolveAge = (resolveAge: number) => {
  if (!resolveAge) {
    return t('Auto-resolution disabled');
  }

  if (resolveAge < 24 || resolveAge % 24 !== 0) {
    return tn(
      'Auto-resolve after %s hour of inactivity',
      'Auto-resolve after %s hours of inactivity',
      resolveAge
    );
  }
  return tn(
    'Auto-resolve after %s day of inactivity',
    'Auto-resolve after %s days of inactivity',
    resolveAge / 24
  );
};

function ResolveSection({project}: {project: Project}) {
  const organization = useOrganization();
  const {data: detailedProject, isPending} = useDetailedProject({
    orgSlug: organization.slug,
    projectSlug: project.slug,
  });

  if (isPending || !detailedProject) {
    return (
      <Section title={t('Resolve')}>
        <Placeholder height="1em" />
      </Section>
    );
  }

  const resolveAgeHours = detailedProject.resolveAge;

  return (
    <Section title={t('Resolve')}>
      <p>{formatResolveAge(resolveAgeHours)}</p>
    </Section>
  );
}

export function ErrorDetectorDetails({detector, project}: ErrorDetectorDetailsProps) {
  return (
    <DetailLayout>
      <DetectorDetailsHeader detector={detector} project={project} />
      <DetailLayout.Body>
        <DetailLayout.Main>
          <DetectorDetailsOngoingIssues />
          <DetectorDetailsAutomations detector={detector} />
        </DetailLayout.Main>
        <DetailLayout.Sidebar>
          <Section title={t('Detect')}>
            <p>
              {tct(
                'All events have a fingerprint. Events with the same fingerprint are grouped together into an issue. To learn more about issue grouping, [link:read the docs].',
                {
                  link: (
                    <ExternalLink href="https://docs.sentry.io/concepts/data-management/event-grouping/" />
                  ),
                }
              )}
            </p>
          </Section>
          <DetectorDetailsAssignee owner={detector.owner} />
          <ResolveSection project={project} />
          <DetectorExtraDetails>
            <DetectorExtraDetails.DateCreated detector={detector} />
            <DetectorExtraDetails.CreatedBy detector={detector} />
            <DetectorExtraDetails.LastModified detector={detector} />
            <DetectorExtraDetails.Environment detector={detector} />
          </DetectorExtraDetails>
        </DetailLayout.Sidebar>
      </DetailLayout.Body>
    </DetailLayout>
  );
}
