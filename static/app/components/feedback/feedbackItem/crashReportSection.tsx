import LinkedIssue from 'sentry/components/feedback/feedbackItem/linkedIssue';
import {Event, Organization} from 'sentry/types';
import {useApiQuery} from 'sentry/utils/queryClient';

interface Props {
  crashReportId: string;
  organization: Organization;
  projSlug: string;
}

export default function CrashReportSection({
  crashReportId,
  organization,
  projSlug,
}: Props) {
  const eventEndpoint = `/projects/${organization.slug}/${projSlug}/events/${crashReportId}/`;
  const {data: crashReportData} = useApiQuery<Event>([eventEndpoint], {staleTime: 0});

  return crashReportData?.groupID ? (
    <LinkedIssue organization={organization} groupID={crashReportData.groupID} />
  ) : null;
}
