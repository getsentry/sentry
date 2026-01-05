import {Fragment} from 'react';
import styled from '@emotion/styled';
import {useVirtualizer} from '@tanstack/react-virtual';
import moment from 'moment-timezone';

import {Link} from '@sentry/scraps/link';

import {Tooltip} from 'sentry/components/core/tooltip';
import {DateTime} from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration';
import ErrorBoundary from 'sentry/components/errorBoundary';
import BreadcrumbItemContent from 'sentry/components/events/breadcrumbs/breadcrumbItemContent';
import type {EnhancedCrumb} from 'sentry/components/events/breadcrumbs/utils';
import {Timeline} from 'sentry/components/timeline';
import {useTimezone} from 'sentry/components/timezoneProvider';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import isValidDate from 'sentry/utils/date/isValidDate';

function BreadcrumbTimestampTooltipBody({timestamp}: {timestamp: Date}) {
  const currentTimezone = useTimezone();
  const isUTCLocalTimezone = currentTimezone === 'UTC';

  return (
    <DescriptionList>
      <dt>{t('Occurred')}</dt>
      <dd>
        <TimestampValues>
          <DateTime date={timestamp} seconds milliseconds timeZone />
          {!isUTCLocalTimezone && (
            <DateTime date={timestamp} seconds milliseconds timeZone utc />
          )}
        </TimestampValues>
      </dd>
      {isUTCLocalTimezone && (
        <Fragment>
          <dt />
          <dd>
            <TimezoneLink to="/settings/account/details/#timezone">
              {t('Add your local timezone')}
            </TimezoneLink>
          </dd>
        </Fragment>
      )}
    </DescriptionList>
  );
}

interface BreadcrumbsTimelineProps {
  breadcrumbs: EnhancedCrumb[];
  /**
   * Required reference to parent container for virtualization. It's recommended to use state instead
   * of useRef since this component will not update when the ref changes, causing it to render empty initially.
   * To enable virtualization, set a fixed height on the `containerElement` node.
   *
   * Example:
   * ```
   * const [container, setContainer] = useState<HTMLElement | null>(null);
   * return (
   *  <div ref={setContainer}>
   *    <BreadcrumbsTimeline containerElement={container} />
   *  </div>
   * )
   * ```
   */
  containerElement: HTMLElement | null;
  /**
   * If true, expands the contents of the breadcrumbs' data payload
   */
  fullyExpanded?: boolean;
  /**
   * Shows the line after the last breadcrumbs icon.
   * Useful for connecting timeline to components rendered after it.
   */
  showLastLine?: boolean;
  /**
   * If specified, will display time relatively.
   */
  startTimeString?: string;
}

export default function BreadcrumbsTimeline({
  breadcrumbs,
  containerElement,
  startTimeString,
  fullyExpanded = true,
  showLastLine = false,
}: BreadcrumbsTimelineProps) {
  const virtualizer = useVirtualizer({
    count: breadcrumbs.length,
    getScrollElement: () => containerElement,
    estimateSize: () => 35,
    // Must match rendered item margins.
    gap: 8,
    overscan: 25,
  });

  if (!breadcrumbs.length) {
    return null;
  }

  const virtualItems = virtualizer.getVirtualItems();
  const items = virtualItems.map(virtualizedRow => {
    const {breadcrumb, raw, title, meta, iconComponent, colorConfig, levelComponent} =
      breadcrumbs[virtualizedRow.index]!;
    const isVirtualCrumb = !defined(raw);

    const timestamp = new Date(breadcrumb.timestamp ?? '');
    const startTimeDate = new Date(startTimeString ?? '');

    const timestampComponent = isValidDate(timestamp) ? (
      <Timestamp>
        <Tooltip
          title={<BreadcrumbTimestampTooltipBody timestamp={timestamp} />}
          isHoverable
          maxWidth={400}
        >
          {isValidDate(startTimeDate) ? (
            <Duration
              seconds={moment(timestamp).diff(moment(startTimeDate), 's', true)}
              exact
              abbreviation
            />
          ) : (
            <DateTime date={timestamp} seconds milliseconds timeZone />
          )}
        </Tooltip>
      </Timestamp>
    ) : null;

    return (
      <BreadcrumbItem
        key={virtualizedRow.key}
        ref={virtualizer.measureElement}
        title={
          <Header>
            <div>
              <TextBreak>{title}</TextBreak>
              {isVirtualCrumb && <Subtitle> - {t('This event')}</Subtitle>}
            </div>
            {levelComponent}
          </Header>
        }
        colorConfig={colorConfig}
        icon={iconComponent}
        timestamp={timestampComponent}
        // XXX: Only the virtual crumb can be marked as active for breadcrumbs
        isActive={isVirtualCrumb ?? false}
        data-index={virtualizedRow.index}
        showLastLine={showLastLine}
      >
        <ContentWrapper>
          <ErrorBoundary mini>
            <BreadcrumbItemContent
              breadcrumb={breadcrumb}
              meta={meta}
              fullyExpanded={fullyExpanded}
            />
          </ErrorBoundary>
        </ContentWrapper>
      </BreadcrumbItem>
    );
  });

  return (
    <div
      style={{
        height: virtualizer.getTotalSize(),
        position: 'relative',
      }}
    >
      <VirtualOffset offset={virtualItems?.[0]?.start ?? 0}>
        <Timeline.Container>{items}</Timeline.Container>
      </VirtualOffset>
    </div>
  );
}

const VirtualOffset = styled('div')<{offset: number}>`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  transform: translateY(${p => p.offset}px);
`;

const Header = styled('div')`
  display: grid;
  grid-template-columns: 1fr auto;
`;

const TextBreak = styled('span')`
  word-wrap: break-word;
  word-break: break-all;
`;

const Subtitle = styled('p')`
  margin: 0;
  font-weight: normal;
  font-size: ${p => p.theme.fontSize.sm};
  display: inline;
`;

const Timestamp = styled('div')`
  margin-right: ${space(1)};
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.sm};
  min-width: 50px;
  text-align: right;
  span {
    text-decoration: underline dashed ${p => p.theme.translucentBorder};
  }
`;

const ContentWrapper = styled('div')`
  padding-bottom: ${space(1)};
`;

const BreadcrumbItem = styled(Timeline.Item)`
  border-bottom: 1px solid transparent;
  &:not(:last-child) {
    border-image: linear-gradient(
        to right,
        transparent 20px,
        ${p => p.theme.tokens.border.secondary} 20px
      )
      100% 1;
  }
`;

const DescriptionList = styled('dl')`
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: ${space(0.75)} ${space(1)};
  text-align: left;
  margin: 0;
`;

const TimestampValues = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.25)};
  font-family: ${p => p.theme.text.familyMono};
`;

const TimezoneLink = styled(Link)`
  line-height: 0.8;
`;
