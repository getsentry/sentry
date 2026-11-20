import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {IconChevron} from '@sentry/icons/chevron';

import {Button} from '@sentry/scraps/button';
import {Container} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';

interface ExploreSidebarToggleProps {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}

export function ExploreSidebarToggle({
  expanded,
  onExpandedChange,
}: ExploreSidebarToggleProps) {
  return (
    <Container as="span" display="inline-flex">
      <StyledExploreSidebarToggle
        aria-label={expanded ? t('Collapse sidebar') : t('Expand sidebar')}
        expanded={expanded}
        size="xs"
        icon={<IconChevron isDouble direction={expanded ? 'left' : 'right'} size="xs" />}
        onClick={() => onExpandedChange(!expanded)}
      >
        {expanded ? null : t('Advanced')}
      </StyledExploreSidebarToggle>
    </Container>
  );
}

const StyledExploreSidebarToggle = styled(Button)<{expanded: boolean}>`
  ${p =>
    p.expanded &&
    // Overlaps the sidebar edge. Layout props can't set this negative margin
    // or the button's ::after border.
    // oxlint-disable-next-line @sentry/scraps/prefer-container-responsive-props
    css`
      @container (min-width: ${p.theme.container.xl}) {
        margin-left: -17px;
        border-top-left-radius: 0;
        border-bottom-left-radius: 0;

        &::after {
          border-left-color: ${p.theme.tokens.border.primary};
          border-top-left-radius: 0;
          border-bottom-left-radius: 0;
        }
      }
    `}
`;
