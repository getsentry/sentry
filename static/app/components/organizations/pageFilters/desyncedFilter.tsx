import styled from '@emotion/styled';

import {
  revertToPinnedFilters,
  saveDesyncedFilters,
} from 'sentry/actionCreators/pageFilters';
import {Button} from 'sentry/components/core/button';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';

export function DesyncedFilterMessage() {
  const organization = useOrganization();
  const router = useRouter();

  return (
    <DesyncedFilterMessageWrap>
      <strong>{t('Filters Updated')}</strong>
      {t(
        'Looks like you opened Sentry through a shared link. Your filters have been updated with new values encoded in the link.'
      )}
      <DesyncedFilterMessageFooter>
        <Button
          size="xs"
          onClick={() => revertToPinnedFilters(organization.slug, router)}
        >
          {t('Restore Previous Values')}
        </Button>
        <Button size="xs" priority="primary" onClick={saveDesyncedFilters}>
          {t('Got It')}
        </Button>
      </DesyncedFilterMessageFooter>
    </DesyncedFilterMessageWrap>
  );
}

export const DesyncedFilterIndicator = styled('div')`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${p => p.theme.active};
  border: solid 1px ${p => p.theme.tokens.background.primary};
  position: absolute;
  top: 0;
  right: -${space(0.75)};
`;

const DesyncedFilterMessageWrap = styled('div')`
  border: solid 1px ${p => p.theme.tokens.border.primary};
  background: ${p => p.theme.backgroundSecondary};
  border-radius: ${p => p.theme.radius.md};
  margin: ${space(0.25)} ${space(0.5)} ${space(0.5)};
  padding: ${space(0.75)};

  font-size: ${p => p.theme.fontSize.sm};

  strong {
    display: block;
    font-weight: ${p => p.theme.fontWeight.bold};
    color: ${p => p.theme.tokens.content.primary};
  }
`;

const DesyncedFilterMessageFooter = styled('div')`
  width: 100%;
  display: flex;
  justify-content: end;
  gap: ${space(0.5)};
  margin-top: ${space(1)};
`;
