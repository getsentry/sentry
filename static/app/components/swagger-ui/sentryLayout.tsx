import SentrySwaggerHeader from './sentrySwaggerHeader';
import SentrySwaggerMenu from './sentrySwaggerMenu';

type SentryLayoutProps = {
  getComponent: Function;
};

const SentryLayout = ({getComponent}: SentryLayoutProps) => {
  const BaseLayout = getComponent('BaseLayout', true);

  return (
    <div className="swagger-ui-sentry">
      <div className="document-wrapper">
        <div className="sidebar">
          <SentrySwaggerHeader />
          <SentrySwaggerMenu />
        </div>

        <main role="main">
          <div className="right-half">
            <div className="navbar-right-half">
              <div className="global-header" />
            </div>
            <div className="content">
              <BaseLayout />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default SentryLayout;
