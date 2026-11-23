import {BrandPageLayout} from 'sentry/components/brandPageLayout';

import {AuthPageLayout} from './authPageLayout';
import {useBrandedArtworkLoading} from './useBrandedArtworkLoading';

export default function BrandedAuthLayout() {
  const isArtworkLoading = useBrandedArtworkLoading();

  return (
    <AuthPageLayout isArtworkLoading={isArtworkLoading}>
      {({content, header, isLoading}) => (
        <BrandPageLayout isArtworkActive={!isLoading}>
          <BrandPageLayout.HeaderStart>{header}</BrandPageLayout.HeaderStart>
          <BrandPageLayout.Content>{content}</BrandPageLayout.Content>
        </BrandPageLayout>
      )}
    </AuthPageLayout>
  );
}
