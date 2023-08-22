import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import Link from 'sentry/components/links/link';
import PanelItem from 'sentry/components/panels/panelItem';
import {IconDelete} from 'sentry/icons';
import {Organization} from 'sentry/types';
import {Funnel} from 'sentry/types/funnel';
import useApi from 'sentry/utils/useApi';

interface Props {
  funnel: Funnel;
  onDelete: (funnelSlug: string) => void;
  organization: Organization;
}

export default function FunnelItem({funnel, organization, onDelete}: Props) {
  return (
    <StyledPanelItem>
      <Link to={`/organizations/${organization.slug}/funnel/${funnel.slug}`}>
        {funnel.name}
      </Link>
      <Button
        icon={<IconDelete size="sm" />}
        aria-label="Delete Funnel"
        onClick={() => onDelete(funnel.slug)}
      />
    </StyledPanelItem>
  );
}

const StyledPanelItem = styled(PanelItem)`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;
