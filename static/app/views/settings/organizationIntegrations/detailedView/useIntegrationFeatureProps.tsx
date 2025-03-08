import styled from '@emotion/styled';

import type {IntegrationFeature} from 'sentry/types/integrations';
import {singleLineRenderer} from 'sentry/utils/marked';
import useOrganization from 'sentry/utils/useOrganization';

export function useIntegrationFeatureProps({
  featureData,
}: {
  featureData: IntegrationFeature[];
}) {
  const organization = useOrganization();
  const features = featureData.map(({featureGate, description}) => ({
    featureGate,
    description: (
      <FeatureListItem
        dangerouslySetInnerHTML={{__html: singleLineRenderer(description)}}
      />
    ),
  }));
  return {
    organization,
    features,
  };
}

const FeatureListItem = styled('span')`
  line-height: 24px;
`;
