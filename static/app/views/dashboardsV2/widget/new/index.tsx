import React from 'react';

import Feature from 'app/components/acl/feature';
import Alert from 'app/components/alert';
import {t} from 'app/locale';
import {PageContent} from 'app/styles/organization';
import withOrganization from 'app/utils/withOrganization';

import WidgetNew from './widgetNew';

type Props = React.ComponentProps<typeof WidgetNew>;

function WidgetNewContainer({organization, ...props}: Props) {
  return (
    <Feature
      features={['metrics']}
      organization={organization}
      renderDisabled={() => (
        <PageContent>
          <Alert type="warning">{t("You don't have access to this feature")}</Alert>
        </PageContent>
      )}
    >
      <WidgetNew {...props} organization={organization} />
    </Feature>
  );
}

export default withOrganization(WidgetNewContainer);
