import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import {Button} from 'sentry/components/button';
import {IconBusiness} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';

import {openUpsellModal} from 'getsentry/actionCreators/modal';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';

type Props = {
  organization: Organization;
};

function OpenInDiscoverBtn(props: Props) {
  const {organization} = props;
  return (
    <Button
      onClick={async () => {
        await openUpsellModal({
          source: 'issue-detail-open-in-discover',
          defaultSelection: 'discover-query',
          organization: props.organization,
        });
        trackGetsentryAnalytics('growth.issue_open_in_discover_upsell_clicked', {
          organization,
        });
      }}
      className="hidden-xs"
      size="sm"
      icon={<IconBusiness />}
    >
      <GuideAnchor target="open_in_discover">{t('Open in Discover')}</GuideAnchor>
    </Button>
  );
}
export default OpenInDiscoverBtn;
