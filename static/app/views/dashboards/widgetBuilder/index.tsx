import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/core/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import WidgetLegendSelectionState from 'sentry/views/dashboards/widgetLegendSelectionState';
import {TraceItemAttributeProvider} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {TraceItemDataset} from 'sentry/views/explore/types';

import WidgetBuilder from './widgetBuilder';

interface WidgetBuilderProps extends React.ComponentProps<typeof WidgetBuilder> {}

function WidgetBuilderContainer(props: WidgetBuilderProps) {
  const organization = useOrganization();
  const navigate = useNavigate();

  return (
    <Feature
      features="dashboards-edit"
      organization={organization}
      renderDisabled={() => (
        <Layout.Page withPadding>
          <Alert.Container>
            <Alert type="warning">{t("You don't have access to this feature")}</Alert>
          </Alert.Container>
        </Layout.Page>
      )}
    >
      <TraceItemAttributeProvider
        traceItemType={TraceItemDataset.SPANS}
        enabled={organization.features.includes('visibility-explore-view')}
      >
        <WidgetBuilder
          {...props}
          widgetLegendState={
            new WidgetLegendSelectionState({
              location: props.location,
              organization,
              dashboard: props.dashboard,
              navigate,
            })
          }
        />
      </TraceItemAttributeProvider>
    </Feature>
  );
}

export default WidgetBuilderContainer;
