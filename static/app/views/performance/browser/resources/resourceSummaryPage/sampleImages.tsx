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
    sorts: [{field: `measurements.${HTTP_RESPONSE_CONTENT_LENGTH}`, kind: 'desc'}],
    limit: 100,
  });

  const uniqueResources = new Set();

  const filteredResources = imageResources.data
    .filter(resource => {
      const fileName = getFileNameFromDescription(resource[SPAN_DESCRIPTION]);
      if (uniqueResources.has(fileName)) {
        return false;
      }
      uniqueResources.add(fileName);
      return true;
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
              size={resource[`measurements.${HTTP_RESPONSE_CONTENT_LENGTH}`]}
              key={resource[SPAN_DESCRIPTION]}
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
      <img src={src} style={{minWidth: imageWidth, height: '200px'}} />
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
  try {
    const url = new URL(description);
    return url.pathname.split('/').pop() || '';
  } catch (e) {
    return description;
  }
};

export default SampleImages;
