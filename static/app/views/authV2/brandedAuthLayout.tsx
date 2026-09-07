import {Outlet, useLocation} from 'react-router-dom';
import {AnimatePresence} from 'framer-motion';

import {BrandPageLayout} from 'sentry/components/brandPageLayout';

export default function BrandedAuthLayout() {
  const location = useLocation();
  const pageKey = location.pathname.split('/').slice(0, 3).join('/');

  return (
    <BrandPageLayout>
      <BrandPageLayout.Content>
        <AnimatePresence initial={false} mode="wait">
          <Outlet key={pageKey} />
        </AnimatePresence>
      </BrandPageLayout.Content>
    </BrandPageLayout>
  );
}
