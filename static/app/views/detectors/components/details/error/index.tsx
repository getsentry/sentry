import {ExternalLink, Link} from 'sentry/components/core/link';
import {Text} from 'sentry/components/core/text';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import Placeholder from 'sentry/components/placeholder';
import DetailLayout from 'sentry/components/workflowEngine/layout/detail';
import Section from 'sentry/components/workflowEngine/ui/section';
import {t, tct, tn} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {useDetailedProject} from 'sentry/utils/project/useDetailedProject';
import useOrganization from 'sentry/utils/useOrganization';
import {DetectorDetailsAutomations} from 'sentry/views/detectors/components/details/common/automations';
import {DisabledAlert} from 'sentry/views/detectors/components/details/common/disabledAlert';
import {DetectorExtraDetails} from 'sentry/views/detectors/components/details/common/extraDetails';
import {DetectorDetailsHeader} from 'sentry/views/detectors/components/details/common/header';
import {DetectorDetailsOngoingIssues} from 'sentry/views/detectors/components/details/common/ongoingIssues';

type ErrorDetectorDetailsProps = {
  detector: Detector;
  project: Project;
};

const formatResolveAge = (resolveAge: number) => {
  if (!resolveAge) {
    return t('Auto-resolution disabled.');
  }

  if (resolveAge < 24 || resolveAge % 24 !== 0) {
    return tn(
      'Auto-resolve after %s hour of inactivity.',
      'Auto-resolve after %s hours of inactivity',
      resolveAge
    );
  }
  return tn(
    'Auto-resolve after %s day of inactivity.',
    'Auto-resolve after %s days of inactivity.',
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
  const organization = useOrganization();

  return (
    <DetailLayout>
      <DetectorDetailsHeader detector={detector} project={project} />
      <DetailLayout.Body>
        <DetailLayout.Main>
          <DisabledAlert
            detector={detector}
            message={t('This monitor is disabled and not creating issues.')}
          />
          <DatePageFilter />
          <DetectorDetailsOngoingIssues detector={detector} />
          <DetectorDetailsAutomations detector={detector} />
        </DetailLayout.Main>
        <DetailLayout.Sidebar>
          <Section title={t('Detect')}>
            <Text as="p">
              {tct(
                'All events have a fingerprint. Events with the same fingerprint are grouped together into an issue. To learn more about issue grouping, [link:read the docs].',
                {
                  link: (
                    <ExternalLink href="https://docs.sentry.io/concepts/data-management/event-grouping/" />
                  ),
                }
              )}
            </Text>
          </Section>
          <Section title={t('Assign')}>
            <Text as="p">
              {tct(
                'Sentry will attempt to automatically assign new issues based on [link:Ownership Rules].',
                {
                  link: (
                    <Link
                      to={`/settings/${organization.slug}/projects/${project?.slug}/ownership/`}
                    />
                  ),
                }
              )}
            </Text>
          </Section>
          <Section title={t('Prioritize')}>
            <Text as="p">
              {tct(
                'New error issues are prioritized based on log level. [link:Learn more about Issue Priority].',
                {
                  link: (
                    <ExternalLink href="https://docs.sentry.io/product/issues/issue-priority/" />
                  ),
                }
              )}
            </Text>
          </Section>
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
