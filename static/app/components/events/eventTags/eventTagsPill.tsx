import {css} from '@emotion/react';
import {Query} from 'history';
import * as qs from 'query-string';

import AnnotatedText from 'sentry/components/events/meta/annotatedText';
import {getMeta} from 'sentry/components/events/meta/metaProxy';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import Pill from 'sentry/components/pill';
import VersionHoverCard from 'sentry/components/versionHoverCard';
import {IconInfo, IconOpen} from 'sentry/icons';
import {Organization} from 'sentry/types';
import {EventTag} from 'sentry/types/event';
import {isUrl} from 'sentry/utils';

import EventTagsPillValue from './eventTagsPillValue';

const iconStyle = css`
  position: relative;
  top: 1px;
`;

type Props = {
  tag: EventTag;
  streamPath: string;
  releasesPath: string;
  query: Query;
  organization: Organization;
  projectId: string;
};

const EventTagsPill = ({
  tag,
  query,
  organization,
  projectId,
  streamPath,
  releasesPath,
}: Props) => {
  const locationSearch = `?${qs.stringify(query)}`;
  const {key, value} = tag;
  const isRelease = key === 'release';
  const name = !key ? <AnnotatedText value={key} meta={getMeta(tag, 'key')} /> : key;
  const type = !key ? 'error' : undefined;

  return (
    <Pill name={name} value={value} type={type}>
      <EventTagsPillValue
        tag={tag}
        meta={getMeta(tag, 'value')}
        streamPath={streamPath}
        locationSearch={locationSearch}
        isRelease={isRelease}
      />
      {isUrl(value) && (
        <ExternalLink href={value} className="external-icon">
          <IconOpen size="xs" css={iconStyle} />
        </ExternalLink>
      )}
      {isRelease && (
        <div className="pill-icon">
          <VersionHoverCard
            organization={organization}
            projectSlug={projectId}
            releaseVersion={value}
          >
            <Link to={{pathname: `${releasesPath}${value}/`, search: locationSearch}}>
              <IconInfo size="xs" css={iconStyle} />
            </Link>
          </VersionHoverCard>
        </div>
      )}
    </Pill>
  );
};

export default EventTagsPill;
