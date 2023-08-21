import Link from 'sentry/components/links/link';
import PanelItem from 'sentry/components/panels/panelItem';
import {Organization} from 'sentry/types';
import {Funnel} from 'sentry/types/funnel';

interface Props {
  funnel: Funnel;
  organization: Organization;
}

export default function FunnelItem({funnel, organization}: Props) {
  return (
    <PanelItem>
      <Link to={`/organizations/${organization.slug}/funnel/${funnel.slug}`}>
        {funnel.name}
      </Link>
    </PanelItem>
  );
}
