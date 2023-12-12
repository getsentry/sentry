import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {formatBytesBase2} from 'sentry/utils';
import getDynamicText from 'sentry/utils/getDynamicText';
import {useIndexedResourcesQuery} from 'sentry/views/performance/browser/resources/utils/useIndexedResourceQuery';
import ChartPanel from 'sentry/views/starfish/components/chartPanel';
import {SpanIndexedField} from 'sentry/views/starfish/types';

type Props = {groupId: string};

const {SPAN_GROUP, SPAN_DESCRIPTION, HTTP_RESPONSE_CONTENT_LENGTH} = SpanIndexedField;
const imageWidth = '200px';

function SampleImages({groupId}: Props) {
  const imageResources = useIndexedResourcesQuery({
    queryConditions: [`${SPAN_GROUP}:${groupId}`],
    limit: 100,
  });

  const uniqueResources = new Set();

  const filteredResources = imageResources.data
    .filter(resource => {
      const size = resource[HTTP_RESPONSE_CONTENT_LENGTH];
      const fileName = getFileNameFromDescription(resource[SPAN_DESCRIPTION]);
      const key = `${fileName}-${size}`;
      if (uniqueResources.has(key) || !size) {
        return false;
      }
      uniqueResources.add(key);
      return true;
    })
    // TODO - we should be sorting on the backend, this is more for a POC
    .sort((a, b) => {
      return b[HTTP_RESPONSE_CONTENT_LENGTH] - a[HTTP_RESPONSE_CONTENT_LENGTH];
    })
    .splice(0, 5);

  return (
    <ChartPanel title={t('Example Images')}>
      <ImageWrapper>
        {filteredResources.map(resource => {
          return (
            <ImageContainer
              src={resource[SPAN_DESCRIPTION]}
              fileName={getFileNameFromDescription(resource[SPAN_DESCRIPTION])}
              size={resource[HTTP_RESPONSE_CONTENT_LENGTH]}
              key={resource.id}
            />
          );
        })}
      </ImageWrapper>
    </ChartPanel>
  );
}

function ImageContainer({
  src,
  fileName,
  size,
}: {
  fileName: string;
  size: number;
  src: string;
}) {
  const fileSize = getDynamicText({
    value: formatBytesBase2(size),
    fixed: 'xx KB',
  });

  return (
    <div style={{width: '100%', wordWrap: 'break-word'}}>
      <img src={src} style={{width: imageWidth, height: '200px'}} />
      {fileName} ({fileSize})
    </div>
  );
}

const ImageWrapper = styled('div')`
  display: grid;
  grid-template-columns: repeat(auto-fill, ${imageWidth});
  gap: 30px;
`;

const getFileNameFromDescription = (description: string) => {
  return description.split('/').pop()?.split(/[?#]/)[0] || '';
};

export default SampleImages;
