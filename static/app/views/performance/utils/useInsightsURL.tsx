import useOrganization from 'sentry/utils/useOrganization';

export function useInsightsURL() {
  const builder = useInsightsURLBuilder();
  return builder();
}

type URLBuilder = () => string;

export function useInsightsURLBuilder(): URLBuilder {
  const organization = useOrganization({allowNull: true}); // Some parts of the app, like the main sidebar, render even if the organization isn't available (during loading, or at all).

  return function () {
    return organization?.features?.includes('performance-insights')
      ? 'insights'
      : 'performance';
  };
}
