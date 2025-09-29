import Feature from 'sentry/components/acl/feature';
import {NoAccess} from 'sentry/components/noAccess';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  children: React.ReactNode;
}

export default function PreventPage({children}: Props) {
  const organization = useOrganization();

  return (
    <Feature
      features={['prevent-ai']}
      organization={organization}
      renderDisabled={NoAccess}
    >
      {children}
    </Feature>
  );
}
