import {useEffect, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {Button} from 'sentry/components/core/button';
import {Link} from 'sentry/components/core/link';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconImage} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {safeURL} from 'sentry/utils/url/safeURL';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import ResourceSize from 'sentry/views/insights/browser/resources/components/resourceSize';
import {useResourceModuleFilters} from 'sentry/views/insights/browser/resources/utils/useResourceFilters';
import ChartPanel from 'sentry/views/insights/common/components/chartPanel';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import type {SpanResponse} from 'sentry/views/insights/types';
import {SpanFields} from 'sentry/views/insights/types';
import {usePerformanceGeneralProjectSettings} from 'sentry/views/performance/utils';

type Props = {groupId: string; projectId?: number};

export const LOCAL_STORAGE_SHOW_LINKS = 'performance-resources-images-showLinks';

const {
  SPAN_GROUP,
  RAW_DOMAIN,
  SPAN_DESCRIPTION,
  MEASUREMENT_HTTP_RESPONSE_CONTENT_LENGTH,
  SPAN_OP,
} = SpanFields;
const imageWidth = '200px';
const imageHeight = '180px';

function SampleImages({groupId, projectId}: Props) {
  const [showLinks, setShowLinks] = useLocalStorageState(LOCAL_STORAGE_SHOW_LINKS, false);
  const filters = useResourceModuleFilters();
  const [showImages, setShowImages] = useState(showLinks);
  const {data: settings, isPending: isSettingsLoading} =
    usePerformanceGeneralProjectSettings(projectId);
  const isImagesEnabled = settings?.enable_images ?? false;

  const {data: imageResources, isPending: isLoadingImages} = useSpans(
    {
      fields: [
        SpanFields.PROJECT,
        SpanFields.SPAN_GROUP,
        SpanFields.RAW_DOMAIN,
        SpanFields.SPAN_DESCRIPTION,
        SpanFields.MEASUREMENT_HTTP_RESPONSE_CONTENT_LENGTH,
      ],
      limit: 100,
      sorts: [{field: MEASUREMENT_HTTP_RESPONSE_CONTENT_LENGTH, kind: 'desc'}],
      search: [
        `${SPAN_GROUP}:${groupId}`,
        ...(filters[SPAN_OP] ? [`${SPAN_OP}:${filters[SPAN_OP]}`] : []),
      ].join(' '),
    },
    'api.insights.resources.sample-images'
  );

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
        isSettingsLoading={isSettingsLoading}
        isImagesEnabled={isImagesEnabled}
        showImages={showImages || isImagesEnabled}
      />
    </ChartPanel>
  );
}

type ImageSpan = Pick<
  SpanResponse,
  | 'span.group'
  | 'raw_domain'
  | 'span.description'
  | 'measurements.http.response_content_length'
>;

function SampleImagesChartPanelBody(props: {
  images: ImageSpan[];
  isImagesEnabled: boolean;
  isLoadingImages: boolean;
  isSettingsLoading: boolean;
  showImages: boolean;
  onClickShowLinks?: () => void;
}) {
  const {
    onClickShowLinks,
    images,
    isLoadingImages,
    showImages,
    isImagesEnabled,
    isSettingsLoading,
  } = props;

  const hasImages = images.length > 0;

  useEffect(() => {
    if (showImages && !hasImages && !isLoadingImages) {
      Sentry.captureException(new Error('No sample images found'));
    }
  }, [showImages, hasImages, isLoadingImages]);

  if (isSettingsLoading || (showImages && isLoadingImages)) {
    return <LoadingIndicator />;
  }

  if (!showImages) {
    return <DisabledImages onClickShowLinks={onClickShowLinks} />;
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
        const hasRawDomain = Boolean(resource[RAW_DOMAIN]);
        const isRelativeUrl = resource[SPAN_DESCRIPTION].startsWith('/');
        let src = resource[SPAN_DESCRIPTION];
        if (isRelativeUrl && hasRawDomain) {
          try {
            const url = new URL(resource[SPAN_DESCRIPTION], resource[RAW_DOMAIN]);
            src = url.href;
          } catch {
            Sentry.setContext('resource', {
              src,
              description: resource[SPAN_DESCRIPTION],
              rawDomain: resource[RAW_DOMAIN],
            });
            Sentry.captureException(new Error('Invalid URL'));
          }
        }

        return (
          <ImageContainer
            src={src}
            showImage={isImagesEnabled}
            fileName={getFileNameFromDescription(resource[SPAN_DESCRIPTION])}
            size={resource[MEASUREMENT_HTTP_RESPONSE_CONTENT_LENGTH]}
            key={resource[SPAN_DESCRIPTION]}
          />
        );
      })}
    </ImageWrapper>
  );
}

export function DisabledImages(props: {
  onClickShowLinks?: () => void;
  projectSlug?: string;
}) {
  const {onClickShowLinks} = props;
  const organization = useOrganization();
  const {
    selection: {projects: selectedProjects},
  } = usePageFilters();
  const {projects} = useProjects();
  const firstProjectSelected = props.projectSlug
    ? {
        slug: props.projectSlug,
      }
    : projects.find(project => project.id === selectedProjects[0]?.toString());

  return (
    <div>
      <ChartPanelTextContainer>
        <IconImage />
        <h6>{t('Images not shown')}</h6>
        {t(
          'You know, you can see the actual images that are on your site if you opt into this feature.'
        )}
      </ChartPanelTextContainer>
      <ButtonContainer>
        <Button onClick={onClickShowLinks}>Only show links</Button>
        <Link
          to={`/settings/${organization.slug}/projects/${firstProjectSelected?.slug}/performance/`}
        >
          <Button priority="primary" data-test-id="enable-sample-images-button">
            {t(' Enable in Settings')}
          </Button>
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
  const [hasError, setHasError] = useState(false);

  const {fileName, size, src, showImage = true} = props;
  const isRelativeUrl = src.startsWith('/');

  const handleError = () => {
    setHasError(true);
  };

  return (
    <div style={{width: '100%', wordWrap: 'break-word'}}>
      {showImage && !isRelativeUrl && !hasError ? (
        <div
          style={{
            width: imageWidth,
            height: imageHeight,
          }}
        >
          <img
            data-test-id="sample-image"
            onError={handleError}
            src={src}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              objectPosition: 'center',
            }}
          />
        </div>
      ) : (
        <MissingImage />
      )}
      {fileName} (<ResourceSize bytes={size} />)
    </div>
  );
}

export function MissingImage() {
  const theme = useTheme();

  return (
    <div
      style={{
        background: theme.colors.gray100,
        width: imageWidth,
        height: imageHeight,
        position: 'relative',
      }}
    >
      <IconImage
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          margin: 'auto',
        }}
      />
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
