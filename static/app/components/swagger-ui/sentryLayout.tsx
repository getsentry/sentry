import SentrySwaggerHeader from './sentrySwaggerHeader';

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
        </div>

        <main role="main">
          <div className="right-half">
            <div className="navbar-right-half">
              <div className="global-header" />
            </div>
          </div>
        </main>
        <div className="content">
          <BaseLayout />
        </div>
      </div>
    </div>
  );
};

export default SentryLayout;
