import {Fragment} from 'react';

import EmptyMessage from 'sentry/components/emptyMessage';
import Panel from 'sentry/components/panels/panel';
import {IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Member} from 'sentry/types/organization';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

function HelpfulMembers() {
  const organization = useOrganization();
  const {data: billingMembers} = useApiQuery<Member[]>(
    [
      `/organizations/${organization.slug}/members/`,
      {query: {query: 'scope:"org:billing"'}},
    ],
    {staleTime: 0}
  );

  if (!billingMembers || billingMembers.length === 0) {
    return null;
  }

  return (
    <p>
      {tct('Maybe a billing admin ([members]) could help?', {
        members: billingMembers.slice(0, 3).map((member, i, list) => (
          <Fragment key={member.id}>
            <a href={`mailto: ${member.email}`}>{member.email}</a>
            {i + 1 < Math.min(list.length, 3) && ', '}
          </Fragment>
        )),
      })}
    </p>
  );
}

function ContactBillingMembers() {
  return (
    <Panel data-test-id="permission-denied">
      <EmptyMessage
        title={t('Insufficient Access')}
        icon={<IconWarning size="xl" />}
        description={
          <Fragment>
            <p>
              {t("You don't have access to manage billing and subscription details.")}
            </p>
            <HelpfulMembers />
          </Fragment>
        }
      />
    </Panel>
  );
}

export default ContactBillingMembers;
