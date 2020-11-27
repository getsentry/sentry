import React from 'react';
import {Link} from 'react-router';
import {css} from '@emotion/core';
import {Location, Query} from 'history';
import * as queryString from 'query-string';

import AnnotatedText from 'app/components/events/meta/annotatedText';
import {getMeta} from 'app/components/events/meta/metaProxy';
import ExternalLink from 'app/components/links/externalLink';
import Pill from 'app/components/pill';
import VersionHoverCard from 'app/components/versionHoverCard';
import {IconInfo, IconOpen} from 'app/icons';
import {EventTag} from 'app/types';
import {isUrl} from 'app/utils';
import TraceHoverCard from 'app/utils/discover/traceHoverCard';

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
  location: Location;
  orgId: string;
  projectId: string;
  hasQueryFeature: boolean;
};

const EventTagsPill = ({
  tag,
  query,
  orgId,
  projectId,
  streamPath,
  releasesPath,
  location,
  hasQueryFeature,
}: Props) => {
  const locationSearch = `?${queryString.stringify(query)}`;
  const {key, value} = tag;
  const isRelease = key === 'release';
  const isTrace = key === 'trace';
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
            orgSlug={orgId}
            projectSlug={projectId}
            releaseVersion={value}
          >
            <Link to={{pathname: `${releasesPath}${value}/`, search: locationSearch}}>
              <IconInfo size="xs" css={iconStyle} />
            </Link>
          </VersionHoverCard>
        </div>
      )}
      {isTrace && hasQueryFeature && (
        <TraceHoverCard
          containerClassName="pill-icon"
          traceId={value}
          orgId={orgId}
          location={location}
        >
          {({to}) => {
            return (
              <Link to={to}>
                <IconOpen size="xs" css={iconStyle} />
              </Link>
            );
          }}
        </TraceHoverCard>
      )}
    </Pill>
  );
};

export default EventTagsPill;
