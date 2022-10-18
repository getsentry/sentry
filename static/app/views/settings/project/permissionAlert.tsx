import Access from 'sentry/components/acl/access';
import Alert from 'sentry/components/alert';
import {t} from 'sentry/locale';

type Props = React.ComponentPropsWithoutRef<typeof Alert> &
  Pick<React.ComponentProps<typeof Access>, 'access'>;

const PermissionAlert = ({access = ['project:write'], ...props}: Props) => (
  <Access access={access}>
    {({hasAccess}) =>
      !hasAccess && (
        <Alert data-test-id="project-permission-alert" type="warning" {...props}>
          {t(
            'These settings can only be edited by users with the organization owner, manager, or admin role.'
          )}
        </Alert>
      )
    }
  </Access>
);

export default PermissionAlert;
