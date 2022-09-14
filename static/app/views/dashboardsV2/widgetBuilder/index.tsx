import Feature from 'sentry/components/acl/feature';
import Alert from 'sentry/components/alert';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import useOrganization from 'sentry/utils/useOrganization';

import WidgetBuilder from './widgetBuilder';

interface WidgetBuilderProps
  extends Omit<React.ComponentProps<typeof WidgetBuilder>, 'organization'> {}

function WidgetBuilderContainer(props: WidgetBuilderProps) {
  const organization = useOrganization();

  return (
    <Feature
      features={['dashboards-edit']}
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

export {WidgetBuilderProps};
export default WidgetBuilderContainer;
