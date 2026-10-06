type AuthV2LoginState =
  | 'auth_config_error'
  | 'login'
  | 'mfa'
  | 'organization_error'
  | 'organization_sso';

export type AuthV2EventParameters = {
  'auth.login.rendered': {
    entrypoint: 'generic' | 'organization';
    state: AuthV2LoginState;
  };
};

export const authV2EventMap: Record<keyof AuthV2EventParameters, string> = {
  'auth.login.rendered': 'Auth: Login Rendered',
};
