import styled from '@emotion/styled';

import FeedbackErrorDetails from 'sentry/components/feedback/details/feedbackErrorDetails';
import FeedbackItem from 'sentry/components/feedback/feedbackItem/feedbackItem';
import useFetchFeedbackItem from 'sentry/components/feedback/useFetchFeedbackItem';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromSlug from 'sentry/utils/useProjectFromSlug';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';

interface Props {
  feedbackId: string;
  projectSlug: string;
}

export default function FeedbackItemLoader({feedbackId, projectSlug}: Props) {
  const organization = useOrganization();
  const project = useProjectFromSlug({organization, projectSlug});

  const {isLoading, isError, data} = useFetchFeedbackItem(
    {feedbackId, organization, project: project!},
    {enabled: Boolean(project)}
  );

  return isLoading || !data ? (
    <Container>
      <Placeholder height="100%" />
    </Container>
  ) : isError || !project ? (
    <FeedbackErrorDetails error={t('Unable to load feedback')} />
  ) : (
    <FeedbackItem feedbackItem={data} />
  );
}

const Container = styled(FluidHeight)`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;
