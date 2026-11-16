import * as qs from 'query-string';

import {Link} from '@sentry/scraps/link';

import {DeviceName} from 'sentry/components/deviceName';
import {Version} from 'sentry/components/version';
import {VersionHoverCard} from 'sentry/components/versionHoverCard';
import type {RenderFunctionBaggage} from 'sentry/utils/discover/fieldRenderers';
import type {AttributesFieldRendererProps} from 'sentry/views/explore/components/traceItemAttributes/attributesTree';
import {getTransactionSummaryBaseUrl} from 'sentry/views/performance/transactionSummary/utils';

const REFERRER = 'seer-event-embed';

export interface EventTagRendererExtra extends RenderFunctionBaggage {
  /** `event.projectID`, which the transaction link needs to scope itself. */
  projectId?: string;
}

type EventTagRendererProps = AttributesFieldRendererProps<EventTagRendererExtra>;

type EventTagRenderer = (props: EventTagRendererProps) => React.ReactNode;

/**
 * Called as a plain function by the tree rather than mounted as a component, so
 * nothing in here may use a hook -- everything it needs arrives on `extra`.
 */
function ReleaseRenderer({basicRendered, extra, item}: EventTagRendererProps) {
  const version = String(item.value ?? '');
  if (!version) {
    return basicRendered;
  }

  const rendered = <Version version={version} truncate shouldWrapText />;

  // The hover card is the one place this reaches for the project, and only once
  // someone hovers -- unlike the tree it replaced, which fetched the detailed
  // project up front just to draw a row.
  return extra.projectSlug ? (
    <VersionHoverCard
      organization={extra.organization}
      projectSlug={extra.projectSlug}
      releaseVersion={version}
      showUnderline
      underlineColor="muted"
    >
      {rendered}
    </VersionHoverCard>
  ) : (
    rendered
  );
}

function TransactionRenderer({basicRendered, extra, item}: EventTagRendererProps) {
  const transaction = String(item.value ?? '');
  if (!transaction) {
    return basicRendered;
  }

  const query = qs.stringify({
    project: extra.projectId,
    transaction,
    referrer: REFERRER,
  });

  return (
    <Link to={`${getTransactionSummaryBaseUrl(extra.organization)}/?${query}`}>
      {transaction}
    </Link>
  );
}

/**
 * Turns an iOS model identifier such as `iPhone13,4` into the name people use
 * for it. Falls through to the raw value for everything it does not recognise.
 */
function DeviceRenderer({basicRendered, item}: EventTagRendererProps) {
  const value = String(item.value ?? '');
  return value ? <DeviceName value={value} /> : basicRendered;
}

/**
 * The tags worth more than their own text, keyed the way the tree looks them
 * up. Everything absent from here still gets the tree's own treatment -- a URL
 * becomes a link, JSON gets structured, and a scrubbed value gets its
 * annotation -- so only add a key here when plain text really loses something.
 */
export const EventTagsRendererMap: Record<string, EventTagRenderer> = {
  release: ReleaseRenderer,
  transaction: TransactionRenderer,
  device: DeviceRenderer,
  'device.model': DeviceRenderer,
};
