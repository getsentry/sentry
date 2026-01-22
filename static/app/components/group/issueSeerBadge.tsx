import {Flex} from 'sentry/components/core/layout';
import {Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import {
  getAutofixRunExists,
  isIssueQuickFixable,
} from 'sentry/components/events/autofix/utils';
import {IconSeer} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

interface IssueSeerBadgeProps {
  group: Group;
}

function IssueSeerBadge({group}: IssueSeerBadgeProps) {
  const organization = useOrganization();
  const issuesPath = `/organizations/${organization.slug}/issues/`;
  const location = useLocation();

  const autofixRunExists = getAutofixRunExists(group);
  const seerFixable = isIssueQuickFixable(group);
  const showSeer =
    organization.features.includes('gen-ai-features') &&
    !organization.hideAiFeatures &&
    (autofixRunExists || seerFixable);

  let seerTitle = null;
  if (autofixRunExists && seerFixable) {
    seerTitle = t('Seer has a potential quick fix for this issue');
  } else if (autofixRunExists) {
    seerTitle = t('Seer has insight into this issue');
  } else if (seerFixable) {
    seerTitle = t('Seer thinks this issue might be quick to fix');
  }

  if (!showSeer) {
    return null;
  }

  return (
    <Tooltip title={seerTitle} skipWrapper>
      <Flex align="center" gap="sm">
        {props => (
          <Link
            to={{
              pathname: `${issuesPath}${group.id}/`,
              query: {...location.query, seerDrawer: true},
            }}
            {...props}
          >
            <IconSeer size="xs" />
            {seerFixable ? t('Quick Fix') : null}
          </Link>
        )}
      </Flex>
    </Tooltip>
  );
}

export default IssueSeerBadge;
