import Feature from 'sentry/components/acl/feature';
import Alert from 'sentry/components/alert';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import {Organization} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';

type Props = {
  children: React.ReactChildren;
  organization: Organization;
};

function PokemonContainer({organization}: Props) {
  return (
    <Feature
      hookName="feature-disabled:profiling-page"
      features={[]}
      organization={organization}
      renderDisabled={() => (
        <PageContent>
          <Alert type="warning">{t("You don't have access to this feature")}</Alert>
        </PageContent>
      )}
    >
      Foo bar
    </Feature>
  );
}

export default withOrganization(PokemonContainer);
