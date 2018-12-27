export function AuthProviders(params = []) {
  return [
    {
      disables2FA: false,
      key: 'dummy',
      name: 'Dummy',
      requiredFeature: 'organizations:sso-basic',
    },
    {
      disables2FA: true,
      key: 'dummy2',
      name: 'Dummy SAML',
      requiredFeature: 'organizations:sso-saml2',
    },
    ...params,
  ];
}
