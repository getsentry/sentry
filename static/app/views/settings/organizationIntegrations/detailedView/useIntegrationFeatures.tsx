import {useMemo} from 'react';
import styled from '@emotion/styled';

import {singleLineRenderer} from '@sentry/scraps/markdown';

import type {IntegrationFeature} from 'sentry/types/integrations';

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
