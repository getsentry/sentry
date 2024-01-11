import {CSSProperties, useEffect, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {Button} from 'sentry/components/button';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {safeURL} from 'sentry/utils/url/safeURL';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import ResourceSize from 'sentry/views/performance/browser/resources/shared/resourceSize';
import {useIndexedResourcesQuery} from 'sentry/views/performance/browser/resources/utils/useIndexedResourceQuery';
import {usePerformanceGeneralProjectSettings} from 'sentry/views/performance/utils';
import ChartPanel from 'sentry/views/starfish/components/chartPanel';
import {SpanIndexedField} from 'sentry/views/starfish/types';

type Props = {groupId: string; projectId?: number};

export const LOCAL_STORAGE_SHOW_LINKS = 'performance-resources-images-showLinks';

const {SPAN_GROUP, SPAN_DESCRIPTION, HTTP_RESPONSE_CONTENT_LENGTH} = SpanIndexedField;
const imageWidth = '200px';
const imageHeight = '180px';

function SampleImages({groupId, projectId}: Props) {
  const [showLinks, setShowLinks] = useLocalStorageState(LOCAL_STORAGE_SHOW_LINKS, false);
  const [showImages, setShowImages] = useState(showLinks);
  const {data: settings} = usePerformanceGeneralProjectSettings(projectId);
  const isImagesEnabled = settings?.enable_images ?? false;

  const {data: imageResources, isLoading: isLoadingImages} = useIndexedResourcesQuery({
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

  const handleClickOnlyShowLinks = () => {
    setShowLinks(true);
    setShowImages(true);
  };

  return (
    <ChartPanel title={showImages ? t('Largest Images') : undefined}>
      <SampleImagesChartPanelBody
        onClickShowLinks={handleClickOnlyShowLinks}
        images={filteredResources}
        isLoadingImages={isLoadingImages}
        isImagesEnabled={isImagesEnabled}
        showImages={showImages || isImagesEnabled}
      />
    </ChartPanel>
  );
}

function SampleImagesChartPanelBody(props: {
  images: ReturnType<typeof useIndexedResourcesQuery>['data'];
  isImagesEnabled: boolean;
  isLoadingImages: boolean;
  showImages: boolean;
  onClickShowLinks?: () => void;
}) {
  const {onClickShowLinks, images, isLoadingImages, showImages, isImagesEnabled} = props;

  useEffect(() => {
    if (showImages && !isImagesEnabled) {
      Sentry.captureException(new Error('No sample images found'));
    }
  }, [showImages, isImagesEnabled]);

  const hasImages = images.length > 0;

  if (!showImages) {
    return <DisabledImages onClickShowLinks={onClickShowLinks} />;
  }
  if (showImages && isLoadingImages) {
    return <LoadingIndicator />;
  }
  if (showImages && !hasImages) {
    return (
      <EmptyStateWarning>
        <p>{t('No images detected')}</p>
      </EmptyStateWarning>
    );
  }

  return (
    <ImageWrapper>
      {images.map(resource => {
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
  const url = safeURL(description);

  if (!url) {
    return description;
  }

  return url.pathname.split('/').pop() ?? '';
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
