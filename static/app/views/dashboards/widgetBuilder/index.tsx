import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import useOrganization from 'sentry/utils/useOrganization';
import {SpanTagsProvider} from 'sentry/views/explore/contexts/spanTagsContext';

import WidgetLegendSelectionState from '../widgetLegendSelectionState';

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
      <SpanTagsProvider
        dataset={DiscoverDatasets.SPANS_EAP}
        enabled={organization.features.includes('dashboards-eap')}
      >
        <WidgetBuilder
          {...props}
          organization={organization}
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
