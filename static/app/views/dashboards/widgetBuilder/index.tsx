import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

import WidgetBuilder from './widgetBuilder';

interface WidgetBuilderProps
  extends Omit<React.ComponentProps<typeof WidgetBuilder>, 'organization'> {}

function WidgetBuilderContainer(props: WidgetBuilderProps) {
  const organization = useOrganization();

  return (
    <Feature
      features="dashboards-edit"
      organization={organization}
      renderDisabled={() => (
        <Layout.Page withPadding>
          <Alert type="warning">{t("You don't have access to this feature")}</Alert>
        </Layout.Page>
      )}
    >
      <WidgetBuilder {...props} organization={organization} />
    </Feature>
  );
}

export {WidgetBuilderProps};
export default WidgetBuilderContainer;
