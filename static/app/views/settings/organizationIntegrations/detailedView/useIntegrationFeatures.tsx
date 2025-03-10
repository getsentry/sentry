import {useMemo} from 'react';
import styled from '@emotion/styled';

import type {IntegrationFeature} from 'sentry/types/integrations';
import {singleLineRenderer} from 'sentry/utils/marked';

export function useIntegrationFeatures({
  featureData,
}: {
  featureData: IntegrationFeature[];
}) {
  return useMemo(
    () =>
      featureData.map(({featureGate, description}) => ({
        featureGate,
        description: (
          <FeatureListItem
            dangerouslySetInnerHTML={{__html: singleLineRenderer(description)}}
          />
        ),
      })),
    [featureData]
  );
}

const FeatureListItem = styled('span')`
  line-height: 24px;
`;
