import {Fragment} from 'react';
import {IconWarning} from '@sentry/icons/warning';

import {EmptyMessage} from 'sentry/components/emptyMessage';
import {Panel} from 'sentry/components/panels/panel';
import {t, tct} from 'sentry/locale';

import {useBillingMembers} from 'getsentry/hooks/useBillingMembers';

function HelpfulMembers() {
  const {data: billingMembers} = useBillingMembers();

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

export function ContactBillingMembers() {
  return (
    <Panel data-test-id="permission-denied">
      <EmptyMessage title={t('Insufficient Access')} icon={<IconWarning />}>
        <p>{t("You don't have access to manage billing and subscription details.")}</p>
        <HelpfulMembers />
      </EmptyMessage>
    </Panel>
  );
}
