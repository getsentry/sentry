import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {CodeBlock} from 'sentry/components/core/code';
import Select from 'sentry/components/forms/controls/reactSelectWrapper';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useQuery} from 'sentry/utils/queryClient';

type RegionData = {region: string; version: string};

type LayerData = {
  account_number: string;
  canonical: string;
  layer_name: string;
  regions: RegionData[];
};

export function useAwsLambdaLayers() {
  const awsLambdaLayers = useQuery<Record<string, LayerData>>({
    queryKey: ['aws-lambda-layers'],
    queryFn: async () => {
      const response = await fetch(
        'https://release-registry.services.sentry.io/aws-lambda-layers'
      );
      return response.json();
    },
  });

  return awsLambdaLayers.data;
}

export function AwsLambdaArnSelector({
  accountNumber,
  layerName,
  regions,
}: {
  accountNumber: string;
  layerName: string;
  regions: RegionData[];
}) {
  const [regionOption, setRegion] = useState<{
    label: string;
    value: string;
  }>();

  const options = useMemo(() => {
    return regions.map(({region}: RegionData) => {
      return {
        label: region,
        value: region,
      };
    });
  }, [regions]);

  const arn = useMemo(() => {
    if (!regionOption) {
      return '';
    }

    const regionData = regions.find(data => data.region === regionOption.value);
    if (!regionData) {
      return '';
    }

    const {version, region} = regionData;
    return `arn:aws:lambda:${region}:${accountNumber}:layer:${layerName}:${version}`;
  }, [regionOption, regions, accountNumber, layerName]);

  return (
    <div>
      <Select
        styles={{
          control: base => ({...base, width: 300}),
          menu: base => ({...base, zIndex: 2}),
        }}
        placeholder={t('Select Region')}
        options={options}
        value={regionOption}
        onChange={value => {
          if (value) {
            setRegion(value);
          }
        }}
      />

      <ArnWrapper>
        <ArnLabel>ARN</ArnLabel>
        <CodeBlock dark language="bash">
          {arn || `# ${t('Select a region')}`}
        </CodeBlock>
      </ArnWrapper>
    </div>
  );
}

const ArnWrapper = styled('div')`
  padding: ${space(2)} 0;
`;

const ArnLabel = styled('h6')`
  margin-bottom: ${space(1)};
`;

export function AwsLambdaArn({canonical}: {canonical: string}) {
  const layers = useAwsLambdaLayers();

  if (!layers) {
    return null;
  }

  const layer = layers[canonical];

  if (!layer) {
    return null;
  }

  return (
    <AwsLambdaArnSelector
      layerName={layer.layer_name}
      accountNumber={layer.account_number}
      regions={layer.regions}
    />
  );
}
