import {withRouter, WithRouterProps} from 'react-router';

import NarrowLayout from 'sentry/components/narrowLayout';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import CreateTeamForm from 'sentry/components/teams/createTeamForm';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';

type Props = WithRouterProps<{orgId: string}, {}> & {
  organization: Organization;
};

function TeamCreate({params, router, organization}: Props) {
  return (
    <SentryDocumentTitle title={t('Create Team')} orgSlug={organization.slug}>
      <NarrowLayout>
        <h3>{t('Create a New Team')}</h3>

        <CreateTeamForm
          onSuccess={data => {
            const {orgId} = params;
            const redirectUrl = `/settings/${orgId}/teams/${data.slug}/`;
            router.push(redirectUrl);
          }}
          organization={organization}
        />
      </NarrowLayout>
    </SentryDocumentTitle>
  );
}

export {TeamCreate};
export default withRouter(withOrganization(TeamCreate));
