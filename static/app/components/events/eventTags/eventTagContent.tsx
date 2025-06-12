import {Fragment} from 'react';
import {css} from '@emotion/react';
import type {Query} from 'history';
import * as qs from 'query-string';

import EventTagsValue from 'sentry/components/events/eventTags/eventTagsValue';
import ExternalLink from 'sentry/components/links/externalLink';
import Version from 'sentry/components/version';
import VersionHoverCard from 'sentry/components/versionHoverCard';
import {IconOpen} from 'sentry/icons';
import type {EventTag} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import {isUrl} from 'sentry/utils/string/isUrl';
import {getTransactionSummaryBaseUrl} from 'sentry/views/performance/transactionSummary/utils';

const iconStyle = css`
  position: relative;
  top: 1px;
`;

type Props = {
  organization: Organization;
  projectId: string;
  projectSlug: string;
  query: Query;
  streamPath: string;
  tag: EventTag;
  meta?: Record<any, any>;
};

function EventTagsContent({
  tag,
  query,
  organization,
  projectSlug,
  projectId,
  streamPath,
  meta,
}: Props) {
  const locationSearch = `?${qs.stringify(query)}`;
  const {key, value} = tag;

  const getInnerContent = () => {
    switch (key) {
      case 'release':
        return (
          <VersionHoverCard
            organization={organization}
            projectSlug={projectSlug}
            releaseVersion={value}
            showUnderline
            underlineColor="linkUnderline"
          >
            <Version version={String(value)} truncate />
          </VersionHoverCard>
        );
      case 'transaction':
        return (
          <EventTagsValue
            tag={tag}
            meta={meta?.value?.['']}
            streamPath={`${getTransactionSummaryBaseUrl(organization)}/`}
            locationSearch={`?${qs.stringify({
              project: projectId,
              transaction: value,
              referrer: 'event-tags',
            })}`}
          />
        );
      default:
        return (
          <EventTagsValue
            tag={tag}
            meta={meta?.value?.['']}
            streamPath={streamPath}
            locationSearch={locationSearch}
          />
        );
    }
  };

  return (
    <Fragment>
      {getInnerContent()}
      {isUrl(value) && (
        <ExternalLink href={value} className="external-icon">
          <IconOpen size="xs" css={iconStyle} />
        </ExternalLink>
      )}
    </Fragment>
  );
}

export default EventTagsContent;
