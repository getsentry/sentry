export function AuthProvider(params = {}) {
  return {
    auth_provider: {
      id: '1',
      provider: 'dummy',
    },
    require_link: true,
    default_role: 'member',
    login_url: 'http://loginUrl',
    provider_name: 'dummy',
    pending_links_count: 0,
    content: '',
    ...params,
  };
}
