export function AuthProviders(params = []) {
  return [
    {
      key: 'dummy',
      name: 'Dummy',
      requiredFeature: 'organizations:sso-basic',
    },
    {
      key: 'dummy2',
      name: 'Dummy SAML',
      requiredFeature: 'organizations:sso-saml2',
    },
    ...params,
  ];
}
