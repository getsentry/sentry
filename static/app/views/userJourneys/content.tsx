import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Breadcrumb} from 'sentry/components/events/interfaces/breadcrumbs/breadcrumb';
import {PanelTable} from 'sentry/components/panels';
import Tooltip from 'sentry/components/tooltip';
import {IconSort} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {EntryType} from 'sentry/types';
import {Crumb} from 'sentry/types/breadcrumbs';

import Timeline from './timeline';

type Props = Pick<
  React.ComponentProps<typeof Breadcrumb>,
  | 'event'
  | 'organization'
  | 'searchTerm'
  | 'relativeTime'
  | 'displayRelativeTime'
  | 'router'
  | 'route'
> & {
  breadcrumbs: Crumb[];
  emptyMessage: Pick<
    React.ComponentProps<typeof PanelTable>,
    'emptyMessage' | 'emptyAction'
  >;
  onSwitchTimeFormat: () => void;
};

function Breadcrumbs({
  breadcrumbs,
  displayRelativeTime,
  onSwitchTimeFormat,
  organization,
  searchTerm,
  event,
  relativeTime,
  emptyMessage,
  route,
  router,
}: Props) {
  const scrollbarSize = 20;

  const entryIndex = event.entries.findIndex(
    entry => entry.type === EntryType.BREADCRUMBS
  );

  return (
    <Fragment>
    <Timeline breadcrumbs={transformedCrumbs} />
    <StyledPanelTable
      scrollbarSize={scrollbarSize}
      headers={[
        t('Type'),
        t('Category'),
        t('Description'),
        t('Level'),
        <Time key="time" onClick={onSwitchTimeFormat}>
          <Tooltip
            containerDisplayMode="inline-flex"
            title={
              displayRelativeTime ? t('Switch to absolute') : t('Switch to relative')
            }
          >
            <StyledIconSort size="xs" rotated />
          </Tooltip>

          {t('Time')}
        </Time>,
        '',
      ]}
      isEmpty={!breadcrumbs.length}
      {...emptyMessage}
    >
      <Content>
        {breadcrumbs.map((breadcrumb, index) => {
          const isLastItem = breadcrumbs[breadcrumbs.length - 1].id === breadcrumb.id;
          return (
            <Fragment key={breadcrumb.id}>
              <Breadcrumb
                data-test-id={isLastItem ? 'last-crumb' : 'crumb'}
                style={{}}
                onLoad={() => {}}
                organization={organization}
                searchTerm={searchTerm}
                breadcrumb={breadcrumb}
                meta={event._meta?.entries?.[entryIndex]?.data?.values?.[index]}
                event={event}
                relativeTime={relativeTime}
                displayRelativeTime={displayRelativeTime}
                height={undefined}
                scrollbarSize={scrollbarSize}
                router={router}
                route={route}
              />
            </Fragment>
          );
        })}
      </Content>
    </StyledPanelTable>
    </Fragment>
  );
}

export default Breadcrumbs;

const StyledPanelTable = styled(PanelTable)<{scrollbarSize: number}>`
  display: grid;
  grid-template-columns: 64px 140px 1fr 106px 100px ${p => `${p.scrollbarSize}px`};

  > * {
    :nth-child(-n + 6) {
      border-bottom: 1px solid ${p => p.theme.border};
      border-radius: 0;
      /* This is to fix a small issue with the border not being fully visible on smaller devices */
      margin-bottom: 1px;

      /* Type */
      :nth-child(6n-5) {
        text-align: center;
      }
    }

    /* Content */
    :nth-child(n + 7) {
      grid-column: 1/-1;
      ${p =>
        !p.isEmpty &&
        `
          padding: 0;
        `}
    }
  }

  @media (max-width: ${props => props.theme.breakpoints.small}) {
    grid-template-columns: 48px 1fr 74px 82px ${p => `${p.scrollbarSize}px`};
    > * {
      :nth-child(-n + 6) {
        /* Type, Category & Level */
        :nth-child(6n-5),
        :nth-child(6n-4),
        :nth-child(6n-2) {
          color: transparent;
        }

        /* Description & Scrollbar */
        :nth-child(6n-3) {
          display: none;
        }
      }
    }
  }

  overflow: hidden;
`;

const Time = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: ${space(1)};
  cursor: pointer;
`;

const StyledIconSort = styled(IconSort)`
  transition: 0.15s color;
  :hover {
    color: ${p => p.theme.gray300};
  }
`;

const Content = styled('div')``;
