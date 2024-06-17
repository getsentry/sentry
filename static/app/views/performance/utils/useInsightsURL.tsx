export function useInsightsURL() {
  const builder = useInsightsURLBuilder();
  return builder();
}

type URLBuilder = () => string;

export function useInsightsURLBuilder(): URLBuilder {
  return function () {
    return 'insights';
  };
}
