export type SignupAnalyticsParameters = {
  'join_request.created': {
    organization: string;
    referrer: string;
  };
};

type SignupAnalyticsKeys = keyof SignupAnalyticsParameters;

export const SignupEventMap: Record<SignupAnalyticsKeys, string | null> = {
  'join_request.created': 'Join Request Created',
};
