import styled from '@emotion/styled';

import {Container, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {NegativeSpaceContainer} from 'sentry/components/container/negativeSpaceContainer';
import * as Storybook from 'sentry/stories';

const images = Object.entries(
  import.meta.glob<string>('../../images/**/*.{svg,gif,png,jpg}', {
    eager: true,
    import: 'default',
  })
).map(([file, src]) => ({
  file: file.replace('../../images/', 'sentry-images/'),
  src,
}));

type ImageEntry = (typeof images)[number];

const toCamelCase = function camalize(str: string) {
  return str
    .toLowerCase()
    .replace(/[^a-zA-Z0-9]+(.)/g, (_match: string, chr: string) => chr.toUpperCase());
};
const nameOfFile = (file: string) => {
  return file.split('/').at(-1)?.split('.').at(0) ?? file;
};

export default Storybook.story('sentry-image/*', story => {
  const spotImages: ImageEntry[] = [];
  const patternImages: ImageEntry[] = [];
  const otherImages: ImageEntry[] = [];

  images.forEach(image => {
    if (image.file.startsWith('sentry-images/spot/')) {
      spotImages.push(image);
    } else if (image.file.startsWith('sentry-images/pattern/')) {
      patternImages.push(image);
    } else {
      otherImages.push(image);
    }
  });

  const section = (title: string, sectionImages: ImageEntry[]) => {
    story(title, () => (
      <Grid columns="repeat(auto-fill, minmax(220px, 1fr))" gap="lg" align="stretch">
        {sectionImages.map(image => (
          <Tooltip
            isHoverable
            key={image.file}
            title={`import ${toCamelCase(nameOfFile(image.file))} from '${image.file}';`}
          >
            <Container
              background="primary"
              border="primary"
              radius="md"
              overflow="hidden"
              minWidth="0"
            >
              <ImagePreview>
                <PreviewImage loading="lazy" alt={image.file} src={image.src} />
              </ImagePreview>
              <Stack gap="xs" minWidth="0" padding="md">
                <Text bold ellipsis size="sm">
                  {nameOfFile(image.file)}
                </Text>
                <Text ellipsis monospace size="xs" variant="muted">
                  {image.file.replace('sentry-images/', '')}
                </Text>
              </Stack>
            </Container>
          </Tooltip>
        ))}
      </Grid>
    ));
  };

  section('sentry-images/spot/*', spotImages);
  section('sentry-images/pattern/*', patternImages);
  section('Other', otherImages);
});

const ImagePreview = styled(NegativeSpaceContainer)`
  height: 180px;
  padding: ${p => p.theme.space.xl};
`;

const PreviewImage = styled('img')`
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
`;
