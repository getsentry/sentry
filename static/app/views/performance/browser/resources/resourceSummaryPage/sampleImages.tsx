import {CSSProperties, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {formatBytesBase2} from 'sentry/utils';
import getDynamicText from 'sentry/utils/getDynamicText';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {useIndexedResourcesQuery} from 'sentry/views/performance/browser/resources/utils/useIndexedResourceQuery';
import ChartPanel from 'sentry/views/starfish/components/chartPanel';
import {SpanIndexedField} from 'sentry/views/starfish/types';

type Props = {groupId: string};

const {SPAN_GROUP, SPAN_DESCRIPTION, HTTP_RESPONSE_CONTENT_LENGTH} = SpanIndexedField;
const imageWidth = '200px';

function SampleImages({groupId}: Props) {
  const isImagesEnabled = false; // TODO - this is temporary, this will be controlled by a project setting
  const [showImages, setShowImages] = useState(isImagesEnabled);

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
    <ChartPanel title={showImages ? t('Example Images') : undefined}>
      {showImages ? (
        <ImageWrapper>
          {filteredResources.map(resource => {
            return (
              <ImageContainer
                src={resource[SPAN_DESCRIPTION]}
                showImage={isImagesEnabled}
                fileName={getFileNameFromDescription(resource[SPAN_DESCRIPTION])}
                size={resource[`measurements.${HTTP_RESPONSE_CONTENT_LENGTH}`]}
                key={resource[SPAN_DESCRIPTION]}
              />
            );
          })}
        </ImageWrapper>
      ) : (
        // TODO - the selection to show only links should be persisted for awhile
        <DisabledImages onClickShowLinks={() => setShowImages(true)} />
      )}
    </ChartPanel>
  );
}

function DisabledImages(props: {onClickShowLinks?: () => void}) {
  const {onClickShowLinks} = props;
  const {
    selection: {projects: selectedProjects},
  } = usePageFilters();
  const {projects} = useProjects();
  const firstProjectSelected = projects.find(
    project => project.id === selectedProjects[0].toString()
  );

  return (
    <div>
      <DisabledImageTextContainer>
        <h6>{t('Images not shown')}</h6>
        {t(
          'You know, you can see the actual images that are on your site if you opt into this feature.'
        )}
      </DisabledImageTextContainer>
      <ButtonContainer>
        <Button onClick={onClickShowLinks}>Only show links</Button>
        <Link
          to={normalizeUrl(
            `/settings/projects/${firstProjectSelected?.slug}/performance/`
          )}
        >
          <Button priority="primary">Enable in Settings</Button>
        </Link>
      </ButtonContainer>
    </div>
  );
}

function ImageContainer(props: {
  fileName: string;
  showImage: boolean;
  size: number;
  src: string;
}) {
  const theme = useTheme();

  const {fileName, size, src, showImage = true} = props;
  const fileSize = getDynamicText({
    value: formatBytesBase2(size),
    fixed: 'xx KB',
  });

  const commonStyles: CSSProperties = {minWidth: imageWidth, height: '200px'};

  return (
    <div style={{width: '100%', wordWrap: 'break-word'}}>
      {
        // TODO - this is temporary, this will be controlled by a project setting
        showImage ? (
          <img src={src} style={commonStyles} />
        ) : (
          <div style={{...commonStyles, backgroundColor: theme.gray100}} />
        )
      }
      {fileName} ({fileSize})
    </div>
  );
}

const getFileNameFromDescription = (description: string) => {
  try {
    const url = new URL(description);
    return url.pathname.split('/').pop() || '';
  } catch (e) {
    return description;
  }
};

const ImageWrapper = styled('div')`
  display: grid;
  grid-template-columns: repeat(auto-fill, ${imageWidth});
  padding-top: ${space(2)};
  gap: 30px;
`;

const ButtonContainer = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, auto);
  gap: ${space(1)};
  justify-content: center;
  align-items: center;
  padding-top: ${space(2)};
`;

const DisabledImageTextContainer = styled('div')`
  text-align: center;
  width: 300px;
  margin: auto;
`;

export default SampleImages;
