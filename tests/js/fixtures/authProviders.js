export function AuthProviders(params = []) {
  return [
    {
      key: 'github',
      name: 'Github',
      requiredFeature: 'organizations:sso-basic',
    },
    {
      key: 'sam2',
      name: 'SAML2',
      requiredFeature: 'organizations:sso-saml2',
    },
    ...params,
  ];
}
