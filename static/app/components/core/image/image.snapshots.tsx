import {Image} from '@sentry/scraps/image';
import {Container} from '@sentry/scraps/layout';

const image =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAECAIAAAA8r+mnAAAAIUlEQVR4nGOIclsFRx+2aMARA04JtwVb4OhSQBQc4ZQAAJb7MWFc2+OOAAAAAElFTkSuQmCC';

describe('Image', () => {
  it.snapshot.each([480, 800])(
    'responsive dimensions at %s',
    () => (
      <Container containerType="inline-size" padding="md" width="100%">
        <Image
          src={image}
          alt="Four colored quadrants"
          loading="eager"
          width={{zero: '100%', md: '400px'}}
          height={{zero: 'auto', md: '300px'}}
        />
      </Container>
    ),
    viewport => ({viewport, tags: {area: 'core'}})
  );
});
