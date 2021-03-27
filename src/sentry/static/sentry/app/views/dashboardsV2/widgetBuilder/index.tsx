import React from 'react';
import {RouteComponentProps} from 'react-router';

import Feature from 'app/components/acl/feature';
import Alert from 'app/components/alert';
import {t} from 'app/locale';
import {PageContent} from 'app/styles/organization';
import {Organization} from 'app/types';
import withOrganization from 'app/utils/withOrganization';

import WidgetBuilder from './widgetBuilder';

type RouteParams = {
  orgId: string;
};

type Props = RouteComponentProps<RouteParams, {}> & {
  organization: Organization;
  children: React.ReactNode;
};

function WidgetBuilderContainer({organization, ...props}: Props) {
  return (
    <Feature
      features={['metrics']}
      organization={organization}
      renderDisabled={() => (
        <PageContent>
          <Alert type="warning">{t("You don't have access to this feature")}</Alert>
        </PageContent>
      )}
    >
      <WidgetBuilder {...props} />
    </Feature>
  );
}

export default withOrganization(WidgetBuilderContainer);
