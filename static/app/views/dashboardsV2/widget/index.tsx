import * as React from 'react';

import Feature from 'sentry/components/acl/feature';
import Alert from 'sentry/components/alert';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import withOrganization from 'sentry/utils/withOrganization';

import WidgetBuilder from './widgetBuilder';

type Props = React.ComponentProps<typeof WidgetBuilder>;

function WidgetBuilderContainer({organization, ...props}: Props) {
  return (
    <Feature
      features={['metrics', 'new-widget-builder-experience', 'dashboards-edit']}
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
