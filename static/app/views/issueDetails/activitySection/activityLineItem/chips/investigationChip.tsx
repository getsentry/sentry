import styled from '@emotion/styled';
import {IconSeer} from '@sentry/icons/seer';

import {Link} from '@sentry/scraps/link';

import type {GroupActivityInvestigationLinked} from 'sentry/types/group';
import {useOrganization} from 'sentry/utils/useOrganization';
import {getInvestigationPath} from 'sentry/views/investigations/utils';

import {InlineChip} from './inlineChip';

type LinkedInvestigation = NonNullable<
  GroupActivityInvestigationLinked['data']['investigation']
>;

export function InvestigationChip({investigation}: {investigation: LinkedInvestigation}) {
  const organization = useOrganization();
  return (
    <Link to={getInvestigationPath(organization.slug, investigation.id)}>
      <InlineChip interactive tone="accent" variant="wrap">
        <WrappedChipIcon size="xs" />
        {investigation.title}
      </InlineChip>
    </Link>
  );
}

// The wrap variant lays the chip out inline, so the icon needs its own spacing.
const WrappedChipIcon = styled(IconSeer)`
  margin-right: ${p => p.theme.space.xs};
  vertical-align: -2px;
`;
