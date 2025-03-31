import Feature from 'sentry/components/acl/feature';
import {NoAccess} from 'sentry/components/noAccess';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import useOrganization from 'sentry/utils/useOrganization';
import PipelineSecondaryNav from 'sentry/views/nav/secondary/sections/pipeline/pipelineSecondaryNav';

interface Props {
  children: React.ReactNode;
}

export default function PipelinePage({children}: Props) {
  const organization = useOrganization();

  return (
    <Feature
      features={['codecov-ui']}
      organization={organization}
      renderDisabled={NoAccess}
    >
      <NoProjectMessage organization={organization}>
        <PipelineSecondaryNav>{children}</PipelineSecondaryNav>
      </NoProjectMessage>
    </Feature>
  );
}
