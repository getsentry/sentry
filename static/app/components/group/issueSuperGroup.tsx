import styled from '@emotion/styled';

import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconGroup} from 'sentry/icons';
import {t} from 'sentry/locale';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {SupergroupDetail} from 'sentry/views/issueList/supergroups/types';

interface Props {
  supergroup: SupergroupDetail;
}

/**
 * Show a badge indicating an issue belongs to a supergroup.
 */
export function IssueSuperGroup({supergroup}: Props) {
  const organization = useOrganization();

  const tooltipTitle = (
    <div>
      <Text bold>{supergroup.title}</Text>
      {supergroup.summary ? (
        <Text size="sm" variant="muted">
          {supergroup.summary}
        </Text>
      ) : null}
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
