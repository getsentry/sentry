import {BrandPageLayout} from 'sentry/components/brandPageLayout';
import {IconSentry} from 'sentry/icons';

export default function AuthLogin() {
  return (
    <BrandPageLayout.HeaderStart>
      <IconSentry size="xl" />
    </BrandPageLayout.HeaderStart>
  );
}
