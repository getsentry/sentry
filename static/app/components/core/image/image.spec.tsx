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
});
