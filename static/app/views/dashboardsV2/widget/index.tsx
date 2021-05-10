import * as React from 'react';

import Feature from 'app/components/acl/feature';
import Alert from 'app/components/alert';
import {t} from 'app/locale';
import {PageContent} from 'app/styles/organization';
import withOrganization from 'app/utils/withOrganization';

import WidgetBuilder from './widgetBuilder';

type Props = React.ComponentProps<typeof WidgetBuilder>;

function WidgetBuilderContainer({organization, ...props}: Props) {
  return (
    <Feature
      features={['metrics', 'dashboards-edit']}
      organization={organization}
      renderDisabled={() => (
        <PageContent>
          <Alert type="warning">{t("You don't have access to this feature")}</Alert>
        </PageContent>
      )}
    >
      <WidgetBuilder {...props} organization={organization} />
    </Feature>
  );
}

export default withOrganization(WidgetBuilderContainer);
