import {withRouter, RouteComponentProps} from 'react-router';
import React from 'react';

import {t} from 'app/locale';
import CreateTeamForm from 'app/components/createTeamForm';
import NarrowLayout from 'app/components/narrowLayout';
import {Organization} from 'app/types';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import withOrganization from 'app/utils/withOrganization';

type Props = RouteComponentProps<{orgId: string}, {}> & {organization: Organization};

const TeamCreate = ({organization, router, params}: Props) => (
  <SentryDocumentTitle title={t('Create Team')} objSlug={params.orgId}>
    <NarrowLayout>
      <h3>{t('Create a New Team')}</h3>

      <CreateTeamForm
        onSuccess={data => router.push(`/settings/${params.orgId}/teams/${data.slug}/`)}
        organization={organization}
      />
    </NarrowLayout>
  </SentryDocumentTitle>
);

export {TeamCreate};

export default withOrganization(withRouter(TeamCreate));
