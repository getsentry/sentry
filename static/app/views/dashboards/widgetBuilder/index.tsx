import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/core/alert/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import useOrganization from 'sentry/utils/useOrganization';
import {SpanTagsProvider} from 'sentry/views/explore/contexts/spanTagsContext';

import WidgetLegendSelectionState from '../widgetLegendSelectionState';

import WidgetBuilder from './widgetBuilder';

interface WidgetBuilderProps extends React.ComponentProps<typeof WidgetBuilder> {}

function WidgetBuilderContainer(props: WidgetBuilderProps) {
  const organization = useOrganization();

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
      <SpanTagsProvider
        dataset={DiscoverDatasets.SPANS_EAP}
        enabled={organization.features.includes('dashboards-eap')}
      >
        <WidgetBuilder
          {...props}
          widgetLegendState={
            new WidgetLegendSelectionState({
              location: props.location,
              organization,
              dashboard: props.dashboard,
              router: props.router,
            })
          }
        />
      </SpanTagsProvider>
    </Feature>
  );
}

export type {WidgetBuilderProps};
export default WidgetBuilderContainer;
