import {hasEveryAccess} from 'sentry/components/acl/access';
import useOrganization from 'sentry/utils/useOrganization';

export default function useCanWriteSettings() {
  const organization = useOrganization();
  const canWrite = hasEveryAccess(['org:write'], {organization});

  return canWrite;
}
