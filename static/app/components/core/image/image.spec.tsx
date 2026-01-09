import React from 'react';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Image} from './image';

describe('Image', () => {
  it('forwards ref', () => {
    const ref = React.createRef<HTMLImageElement>();
    render(<Image src="https://example.com/image.png" alt="Example Image" ref={ref} />);
    expect(screen.getByRole('img')).toBeInTheDocument();
    expect(ref.current).toBeInTheDocument();
  });

  it('renders the image with the src attribute', () => {
    render(<Image src="https://example.com/image.png" alt="Example Image" />);
    expect(screen.getByRole('img')).toHaveAttribute(
      'src',
      'https://example.com/image.png'
    );
  });

  it('calls onError callback when image fails to load', () => {
    render(
      <Image
        src="https://example.com/broken-image.png"
        alt="Example Image"
        onError={e => {
          (e.target as HTMLImageElement).src = 'https://example.com/image.png';
        }}
      />
    );

    const img = screen.getByAltText('Example Image');
    img.dispatchEvent(new Event('error'));

    expect(img).toHaveAttribute('src', 'https://example.com/image.png');
  });

  it('renders with aspect-ratio prop', () => {
    render(
      <Image src="https://example.com/image.png" alt="Example Image" aspectRatio="16/9" />
    );
    expect(screen.getByRole('img')).toBeInTheDocument();
  });
});
