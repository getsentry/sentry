import * as React from 'react';
import {InjectedRouter} from 'react-router/lib/Router';

import {t} from 'app/locale';
import {Organization} from 'app/types';
import {IconSiren} from 'app/icons';
import Button from 'app/components/button';
import Access from 'app/components/acl/access';
import {navigateTo} from 'app/actionCreators/navigation';

type Props = {
  router: InjectedRouter;
  organization: Organization;
  buttonProps?: React.ComponentProps<typeof Button>;
  iconProps?: React.ComponentProps<typeof IconSiren>;
};

const CreateRuleButton = ({router, organization, buttonProps, iconProps}: Props) => (
  <Access organization={organization} access={['project:write']}>
    {({hasAccess}) => (
      <Button
        disabled={!hasAccess}
        title={
          !hasAccess
            ? t('Users with admin permission or higher can create alert rules.')
            : undefined
        }
        onClick={e => {
          e.preventDefault();

          navigateTo(
            `/organizations/${organization.slug}/alerts/:projectId/new/?referrer=alert_stream`,
            router
          );
        }}
        priority="primary"
        href="#"
        icon={<IconSiren {...iconProps} />}
        {...buttonProps}
      >
        {t('Create Alert Rule')}
      </Button>
    )}
  </Access>
);

export default CreateRuleButton;
