import styled from '@emotion/styled';
import {LocationDescriptor} from 'history';

import MenuHeader from 'sentry/components/actions/menuHeader';
import ExternalLink from 'sentry/components/links/externalLink';
import MenuItem from 'sentry/components/menuItem';
import Tag, {Background} from 'sentry/components/tag';
import Truncate from 'sentry/components/truncate';
import space from 'sentry/styles/space';
import {getDuration} from 'sentry/utils/formatters';
import {QuickTraceEvent} from 'sentry/utils/performance/quickTrace/types';
import {Theme} from 'sentry/utils/theme';

export const SectionSubtext = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeMedium};
`;

export const QuickTraceContainer = styled('div')`
  display: flex;
  align-items: center;
`;

const nodeColors = (theme: Theme) => ({
  error: {
    color: theme.white,
    background: theme.red300,
    border: theme.red300,
  },
  warning: {
    color: theme.red300,
    background: theme.background,
    border: theme.red300,
  },
  white: {
    color: theme.textColor,
    background: theme.background,
    border: theme.textColor,
  },
  black: {
    color: theme.background,
    background: theme.textColor,
    border: theme.textColor,
  },
});

export const EventNode = styled(Tag)`
  span {
    display: flex;
    color: ${p => nodeColors(p.theme)[p.type || 'white'].color};
  }
  & ${Background} {
    background-color: ${p => nodeColors(p.theme)[p.type || 'white'].background};
    border: 1px solid ${p => nodeColors(p.theme)[p.type || 'white'].border};
  }
`;

export const TraceConnector = styled('div')`
  width: ${space(1)};
  border-top: 1px solid ${p => p.theme.textColor};
`;

/**
 * The DropdownLink component is styled directly with less and the way the
 * elements are laid out within means we can't apply any styles directly
 * using emotion. Instead, we wrap it all inside a span and indirectly
 * style it here.
 */
export const DropdownContainer = styled('span')`
  .dropdown-menu {
    padding: 0;
  }
`;

export const DropdownMenuHeader = styled(MenuHeader)<{first?: boolean}>`
  background: ${p => p.theme.backgroundSecondary};
  ${p => p.first && 'border-radius: 2px'};
  padding: ${space(1)} ${space(1.5)};
`;

const StyledMenuItem = styled(MenuItem)<{width: 'small' | 'large'}>`
  width: ${p => (p.width === 'large' ? '350px' : '200px')};

  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.innerBorder};
  }
`;

const MenuItemContent = styled('div')`
  display: flex;
  justify-content: space-between;
  width: 100%;
`;

type DropdownItemProps = {
  children: React.ReactNode;
  allowDefaultEvent?: boolean;
  onSelect?: (eventKey: any) => void;
  to?: string | LocationDescriptor;
  width?: 'small' | 'large';
};

export function DropdownItem({
  children,
  onSelect,
  allowDefaultEvent,
  to,
  width = 'large',
}: DropdownItemProps) {
  return (
    <StyledMenuItem
      data-test-id="dropdown-item"
      to={to}
      onSelect={onSelect}
      width={width}
      allowDefaultEvent={allowDefaultEvent}
    >
      <MenuItemContent>{children}</MenuItemContent>
    </StyledMenuItem>
  );
}

export const DropdownItemSubContainer = styled('div')`
  display: flex;
  flex-direction: row;

  > a {
    padding-left: 0 !important;
  }
`;

export const QuickTraceValue = styled(Truncate)`
  margin-left: ${space(1)};
  white-space: nowrap;
`;

export const ErrorNodeContent = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, auto);
  gap: ${space(0.25)};
  align-items: center;
`;

export const ExternalDropdownLink = styled(ExternalLink)`
  display: inherit !important;
  padding: 0 !important;
  color: ${p => p.theme.textColor};
  &:hover {
    color: ${p => p.theme.textColor};
  }
`;

export function SingleEventHoverText({event}: {event: QuickTraceEvent}) {
  return (
    <div>
      <Truncate
        value={event.transaction}
        maxLength={30}
        leftTrim
        trimRegex={/\.|\//g}
        expandable={false}
      />
      <div>
        {getDuration(
          event['transaction.duration'] / 1000,
          event['transaction.duration'] < 1000 ? 0 : 2,
          true
        )}
      </div>
    </div>
  );
}
