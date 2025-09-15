import Redirect from 'sentry/components/redirect';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useOrganization from 'sentry/utils/useOrganization';

function SettingsIndex() {
  // Organization may be null on settings index if the user is not part of any
  // organization
  const organization = useOrganization({allowNull: true});

  if (organization) {
    return <Redirect to={normalizeUrl(`/settings/${organization.slug}/`)} />;
  }

  return <Redirect to="/settings/account/" />;
}

export default SettingsIndex;
