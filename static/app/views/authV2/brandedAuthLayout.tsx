import {Outlet, useLocation} from 'react-router-dom';
import {AnimatePresence} from 'framer-motion';

import {BrandPageLayout} from 'sentry/components/brandPageLayout';

export default function BrandedAuthLayout() {
  const location = useLocation();

  return (
    <BrandPageLayout>
      <BrandPageLayout.Content>
        <AnimatePresence initial={false} mode="wait">
          <Outlet key={location.pathname} />
        </AnimatePresence>
      </BrandPageLayout.Content>
    </BrandPageLayout>
  );
}
