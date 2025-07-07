import {LinkButton} from 'sentry/components/core/button/linkButton';
import {IconMegaphone} from 'sentry/icons';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

import ZendeskLink from 'getsentry/components/zendeskLink';

function ReplayZendeskFeedback() {
  const organization = useOrganization();

  return (
    <ZendeskLink
      source="replay_details"
      organization={organization}
      Component={({href, onClick}) => (
        <LinkButton
          href={href ?? ''}
          size="sm"
          icon={<IconMegaphone size="sm" />}
          onClick={e => onClick?.(e)}
        >
          {t('Contact Us')}
        </LinkButton>
      )}
    />
  );
}

export default ReplayZendeskFeedback;
