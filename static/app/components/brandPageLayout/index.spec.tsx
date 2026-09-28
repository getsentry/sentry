import {useEffect} from 'react';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {BrandPageLayout} from 'sentry/components/brandPageLayout';

describe('BrandPageLayout', () => {
  it('places right header content in the trailing column without left content', () => {
    render(
      <BrandPageLayout>
        <BrandPageLayout.HeaderEnd>Close</BrandPageLayout.HeaderEnd>
      </BrandPageLayout>
    );

    expect(screen.getByText('Close').closest('[style]')).toHaveStyle({gridColumn: '3'});
  });

  it('holds artwork effects while its activity is hidden', async () => {
    const onArtworkActive = jest.fn();

    function Artwork() {
      useEffect(() => {
        onArtworkActive();
      }, []);

      return null;
    }

    const {rerender} = render(
      <BrandPageLayout artwork={<Artwork />} isArtworkActive={false}>
        Content
      </BrandPageLayout>
    );

    expect(onArtworkActive).not.toHaveBeenCalled();

    rerender(
      <BrandPageLayout artwork={<Artwork />} isArtworkActive>
        Content
      </BrandPageLayout>
    );

    await waitFor(() => expect(onArtworkActive).toHaveBeenCalledTimes(1));
  });
});
