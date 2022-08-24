import {useState} from 'react';

import DocsSelector, {Docs} from './docs/docsSelector';
import SentrySwaggerHeader from './sentrySwaggerHeader';
import SentrySwaggerMenu, {MenuItem} from './sentrySwaggerMenu';

type SentryLayoutProps = {
  getComponent: Function;
};

const SentryLayout = ({getComponent}: SentryLayoutProps) => {
  const BaseLayout = getComponent('BaseLayout', true);
  const HighlightCode = getComponent('highlightCode');

  const [selectedMenuItem, setSelectedMenuItem] = useState<Docs | string>(
    'API REFERENCE'
  );

  const menuItems: MenuItem[] = [
    {
      title: 'API REFERENCE',
    },
    {
      title: Docs.Auth,
      href: '/api/auth/',
    },
    {
      title: Docs.Pagination,
      href: '/api/pagination/',
    },
    {
      title: Docs.Permissions,
      href: '/api/pagination/',
    },
    {
      title: Docs.RateLimits,
      href: '/api/pagination/',
    },
    {
      title: Docs.Request,
      href: '/api/pagination/',
    },
  ];

  const handleMenuClick = (item: MenuItem) => {
    setSelectedMenuItem(item.title);
  };

  return (
    <div className="swagger-ui-sentry">
      <div className="document-wrapper">
        <div className="sidebar">
          <SentrySwaggerHeader />
          <SentrySwaggerMenu menuItems={menuItems} onMenuItemClick={handleMenuClick} />
        </div>

        <main role="main">
          <div className="right-half">
            <div className="navbar-right-half">
              <div className="global-header" />
            </div>
            <div className="content">
              {selectedMenuItem !== 'API REFERENCE' && (
                <DocsSelector
                  docName={selectedMenuItem as Docs}
                  HighlightCode={HighlightCode}
                />
              )}
              {selectedMenuItem === 'API REFERENCE' && <BaseLayout />}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default SentryLayout;
