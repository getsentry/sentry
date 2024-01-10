import {CSSProperties, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import ResourceSize from 'sentry/views/performance/browser/resources/shared/resourceSize';
import {useIndexedResourcesQuery} from 'sentry/views/performance/browser/resources/utils/useIndexedResourceQuery';
import ChartPanel from 'sentry/views/starfish/components/chartPanel';
import {SpanIndexedField} from 'sentry/views/starfish/types';

type Props = {groupId: string};

const {SPAN_GROUP, SPAN_DESCRIPTION, HTTP_RESPONSE_CONTENT_LENGTH} = SpanIndexedField;
const imageWidth = '200px';
const imageHeight = '180px';

function SampleImages({groupId}: Props) {
  const isImagesEnabled = true; // TODO - this is temporary, this will be controlled by a project setting
  const [showImages, setShowImages] = useState(isImagesEnabled);

  const {data: imageResources, isLoading: isLoadingImagesLoading} =
    useIndexedResourcesQuery({
      queryConditions: [`${SPAN_GROUP}:${groupId}`],
      sorts: [{field: `measurements.${HTTP_RESPONSE_CONTENT_LENGTH}`, kind: 'desc'}],
      limit: 100,
    });

  const uniqueResources = new Set();

  const filteredResources = imageResources
    .filter(resource => {
      const fileName = getFileNameFromDescription(resource[SPAN_DESCRIPTION]);
      if (uniqueResources.has(fileName)) {
        return false;
      }
      uniqueResources.add(fileName);
      return true;
    })
    .splice(0, 5);

  const hasImages = filteredResources.length > 0;

  let body: React.ReactNode;

  if (!showImages) {
    body = <DisabledImages onClickShowLinks={() => setShowImages(true)} />;
  } else if (showImages && isLoadingImagesLoading) {
    body = <LoadingIndicator />;
  } else if (showImages && !hasImages) {
    body = (
      <EmptyStateWarning>
        <p>{t('No results found for your query')}</p>
      </EmptyStateWarning>
    );
  } else {
    body = (
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
    );
  }

  return (
    <ChartPanel title={showImages ? t('Largest Images') : undefined}>{body}</ChartPanel>
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
      <ChartPanelTextContainer>
        <h6>{t('Images not shown')}</h6>
        {t(
          'You know, you can see the actual images that are on your site if you opt into this feature.'
        )}
      </ChartPanelTextContainer>
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
  const [hasError, setHasError] = useState(false);

  const {fileName, size, src, showImage = true} = props;

  const commonStyles: CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    objectPosition: 'center',
  };

  return (
    <div style={{width: '100%', wordWrap: 'break-word'}}>
      {showImage && !hasError ? (
        <div
          style={{
            width: imageWidth,
            height: imageHeight,
          }}
        >
          <img onError={() => setHasError(true)} src={src} style={commonStyles} />
        </div>
      ) : (
        <div
          style={{width: imageWidth, height: imageHeight, backgroundColor: theme.gray100}}
        />
      )}
      {fileName} (<ResourceSize bytes={size} />)
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

const ChartPanelTextContainer = styled('div')`
  text-align: center;
  width: 300px;
  margin: auto;
`;

export default SampleImages;
