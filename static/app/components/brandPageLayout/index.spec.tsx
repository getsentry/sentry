import {render, screen} from 'sentry-test/reactTestingLibrary';

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
});
