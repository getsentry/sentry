import {useEffect, useState} from 'react';
import styled from '@emotion/styled';

import SizingWindow from 'sentry/components/stories/sizingWindow';
import TextOverflow from 'sentry/components/textOverflow';
import {Tooltip} from 'sentry/components/tooltip';
import storyBook from 'sentry/stories/storyBook';
import {space} from 'sentry/styles/space';

const toCamelCase = function camalize(str: any) {
  return str
    .toLowerCase()
    .replace(/[^a-zA-Z0-9]+(.)/g, (_m: any, chr: any) => chr.toUpperCase());
};
const nameOfFile = (file: string) => {
  return file.split('/').at(-1)?.split('.').at(0);
};

function imagesContext() {
  const context = require.context('sentry-images', true, /\.(svg|gif|png)$/, 'lazy');
  return {
    files: () =>
      context.keys().map((file: any) => file.replace(/^\.\//, 'sentry-images/')),
    importImage: (filename: string) =>
      context(filename.replace(/^sentry-images\//, './')),
  };
}

function LazyImage({file, module}: {file: string; module: Promise<string>}) {
  const [imgSrc, setImgSrc] = useState<string | undefined>(undefined);

  useEffect(() => {
    module.then(mod => {
      setImgSrc(mod);
    });
  }, [module]);

  return (
    <SizingWindow>
      <img alt={file} src={imgSrc ?? ''} />
    </SizingWindow>
  );
}

export default storyBook('sentry-image/*', story => {
  const context = imagesContext();

  const allFiles = context.files();
  const spotImages: string[] = [];
  const patternImages: string[] = [];
  const otherImages: string[] = [];

  allFiles.forEach((file: any) => {
    if (file.startsWith('sentry-images/spot/')) {
      spotImages.push(file);
    } else if (file.startsWith('sentry-images/pattern/')) {
      patternImages.push(file);
    } else {
      otherImages.push(file);
    }
  });

  const section = (title: string, images: string[]) => {
    story(title, () => (
      <Grid>
        {images.map(file => (
          <GridCell key={file}>
            <Tooltip
              isHoverable
              title={`import ${toCamelCase(nameOfFile(file))} from '${file}';`}
            >
              <TextOverflow>
                <code>{nameOfFile(file)}</code>
              </TextOverflow>
              <LazyImage file={file} module={context.importImage(file)} />
            </Tooltip>
          </GridCell>
        ))}
      </Grid>
    ));
  };

  section('sentry-images/spot/*', spotImages);
  section('sentry-images/pattern/*', patternImages);
  section('Other', otherImages);
});

const Grid = styled('ul')`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  grid-template-rows: masonry;
  gap: ${space(1)};
  align-items: flex-start;

  margin: 0;
  padding: 0;
  & > li {
    margin: 0;
    padding: 0;
    list-style: none;
  }
`;

const GridCell = styled('li')`
  display: flex;
  align-content: flex-start;
`;
