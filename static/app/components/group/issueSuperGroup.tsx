import styled from '@emotion/styled';

import {Link} from '@sentry/scraps/link';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconGroup} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {SupergroupInfo} from 'sentry/utils/supergroup/useSuperGroupForIssues';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';

interface Props {
  supergroup: SupergroupInfo;
}

/**
 * Show a badge indicating an issue belongs to a supergroup.
 */
export function IssueSuperGroup({supergroup}: Props) {
  const organization = useOrganization();

  const tooltipTitle = (
    <div>
      <div>{supergroup.title}</div>
      {supergroup.summary ? <TooltipSummary>{supergroup.summary}</TooltipSummary> : null}
    </div>
  );

  return (
    <Tooltip title={tooltipTitle} skipWrapper>
      <SuperGroupLink
        to={normalizeUrl(`/organizations/${organization.slug}/issues/supergroups/`)}
        aria-label={t('supergroup')}
      >
        <IconGroup size="xs" />
        {`SG-${supergroup.id}`}
      </SuperGroupLink>
    </Tooltip>
  );
}

const SuperGroupLink = styled(Link)`
  display: inline-flex;
  color: ${p => p.theme.colors.gray500};
  font-size: ${p => p.theme.font.size.sm};
  gap: 0 ${p => p.theme.space.xs};
  position: relative;

  &:hover {
    color: ${p => p.theme.tokens.interactive.link.accent.hover};
  }
`;

const TooltipSummary = styled('div')`
  margin-top: ${p => p.theme.space.xs};
  font-size: ${p => p.theme.font.size.sm};
  opacity: 0.8;
`;
